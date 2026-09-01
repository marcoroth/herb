# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/dev"

module Dev
  class PipelineTest < Minitest::Spec
    class FakeServer
      attr_reader :messages #: Array[Array[untyped]]

      def initialize
        @messages = []
      end

      def broadcast(message, to: :all)
        @messages << [message, to]
      end
    end

    Compiled = Struct.new(:mode, :manifest, :version, :slot_entries, :statics, :static_markup, :diagnostics)

    def event(kind, relative_path, previous, current)
      Herb::Dev::Watcher::Event.new(
        kind: kind,
        path: "/app/#{relative_path}",
        relative_path: relative_path,
        previous: previous,
        current: current
      )
    end

    def compiled(version: "abcd1234", mode: :client, diagnostics: [], slot_entries: [], states: nil)
      Compiled.new(mode, { "names" => {}, "states" => states }, version, slot_entries, nil, nil, diagnostics)
    end

    def pipeline(server, compiler: nil)
      Herb::Dev::Pipeline.new(server: server, compiler: -> { compiler })
    end

    test "a whitespace change broadcasts nothing" do
      server = FakeServer.new

      pipeline(server).handle_event(
        event(:changed, "a.html.erb", "<div>\n  <p>Hi</p>\n</div>\n", "<div>\n    <p>Hi</p>\n</div>\n")
      )

      assert_empty server.messages
    end

    test "a parse error broadcasts an error message" do
      server = FakeServer.new

      pipeline(server).handle_event(event(:changed, "a.html.erb", "<div></div>", "<div>\n  <form>\n</div>\n"))

      types = server.messages.map { |message, _| message[:type] }

      assert_equal ["error"], types
    end

    test "without a compiler a dynamic change is an invalidate telling browsers to fetch" do
      server = FakeServer.new

      pipeline(server).handle_event(event(:changed, "a.html.erb", "<p><%= a %></p>", "<p><%= b %></p>"))

      message, to = server.messages.first

      assert_equal "invalidate", message[:type]
      assert_equal "fetch", message[:scope]
      assert_nil message[:version]
      assert_equal :browsers, to
    end

    test "without a compiler a static change is scoped static" do
      server = FakeServer.new

      pipeline(server).handle_event(event(:changed, "a.html.erb", "<p>Hi</p>", "<p>Hello</p>"))

      message, = server.messages.first

      assert_equal "static", message[:scope]
    end

    test "with a compiler a change broadcasts schema then invalidate to browsers" do
      server = FakeServer.new

      pipeline(server, compiler: ->(_source, _path) { compiled }).handle_event(
        event(:changed, "a.html.erb", "<p>Hi</p>", "<p>Hello</p>")
      )

      types = server.messages.map { |message, _| message[:type] }
      targets = server.messages.map { |_, to| to }.uniq

      assert_equal ["schema", "invalidate"], types
      assert_equal [:browsers], targets
    end

    test "the schema always carries diagnostics, and an empty array marks the file clean" do
      server = FakeServer.new

      pipeline(server, compiler: ->(_source, _path) { compiled }).handle_event(
        event(:changed, "a.html.erb", "<p>Hi</p>", "<p>Hello</p>")
      )

      schema, = server.messages.first

      assert_equal [], schema[:diagnostics]
    end

    test "an unchanged version with a moved state manifest scopes to state" do
      server = FakeServer.new
      manifests = [{ "reads" => { "count" => [0] } }, { "reads" => { "count" => [1] } }].each
      compiler = ->(_source, _path) { compiled(version: "same", states: manifests.next) }
      subject = pipeline(server, compiler: compiler)

      subject.handle_event(event(:changed, "a.html.erb", "<p><%= a %></p>", "<p><%= b %></p>"))
      server.messages.clear
      subject.handle_event(event(:changed, "a.html.erb", "<p><%= b %></p>", "<p><%= c %></p>"))

      invalidate, = server.messages.last

      assert_equal "state", invalidate[:scope]
      assert_equal "same", invalidate[:version]
    end

    test "an unchanged version with an unmoved state manifest scopes to fetch" do
      server = FakeServer.new
      compiler = ->(_source, _path) { compiled(version: "same", states: { "reads" => {} }) }
      subject = pipeline(server, compiler: compiler)

      subject.handle_event(event(:changed, "a.html.erb", "<p><%= a %></p>", "<p><%= b %></p>"))
      server.messages.clear
      subject.handle_event(event(:changed, "a.html.erb", "<p><%= b %></p>", "<p><%= c %></p>"))

      invalidate, = server.messages.last

      assert_equal "fetch", invalidate[:scope]
    end

    test "a changed version scopes a dynamic change to fetch" do
      server = FakeServer.new
      versions = ["v1", "v2"].each
      compiler = ->(_source, _path) { compiled(version: versions.next) }
      subject = pipeline(server, compiler: compiler)

      subject.handle_event(event(:changed, "a.html.erb", "<p><%= a %></p>", "<p><%= b %></p>"))
      server.messages.clear
      subject.handle_event(event(:changed, "a.html.erb", "<p><%= b %></p>", "<p><%= c %></p>"))

      schema, = server.messages.first
      invalidate, = server.messages.last

      assert_equal({ from: "v1", to: "v2" }, schema[:version])
      assert_equal "fetch", invalidate[:scope]
    end

    test "compile diagnostics enter the error state and a clean compile clears them" do
      server = FakeServer.new
      results = [
        compiled(diagnostics: [{ message: "bad state read", severity: :error }]),
        compiled
      ].each
      subject = pipeline(server, compiler: ->(_source, _path) { results.next })

      subject.handle_event(event(:changed, "a.html.erb", "<p>Hi</p>", "<p>Hello</p>"))

      first_schema, = server.messages.first

      assert_equal 1, first_schema[:diagnostics].length

      server.messages.clear
      subject.handle_event(event(:changed, "a.html.erb", "<p>Hello</p>", "<p>Howdy</p>"))

      second_schema, = server.messages.first

      assert_equal [], second_schema[:diagnostics]
    end

    test "a compiler raise becomes a diagnostics-only schema, not a crash" do
      server = FakeServer.new

      pipeline(server, compiler: ->(_source, _path) { raise "boom" }).handle_event(
        event(:changed, "a.html.erb", "<p>Hi</p>", "<p>Hello</p>")
      )

      schema, = server.messages.first

      assert_equal "schema", schema[:type]
      assert_equal 1, schema[:diagnostics].length
      assert_includes schema[:diagnostics].first[:message], "boom"
    end

    test "a compiler answering nil degrades to the no-compiler path" do
      server = FakeServer.new

      pipeline(server, compiler: ->(_source, _path) {}).handle_event(
        event(:changed, "a.html.erb", "<p><%= a %></p>", "<p><%= b %></p>")
      )

      message, = server.messages.first

      assert_equal "invalidate", message[:type]
      assert_equal "fetch", message[:scope]
    end

    test "removing an errored file broadcasts a clearing schema" do
      server = FakeServer.new
      subject = pipeline(server)

      subject.handle_event(event(:changed, "a.html.erb", "<div></div>", "<div>\n  <form>\n</div>\n"))
      server.messages.clear
      subject.handle_event(event(:removed, "a.html.erb", "<div>\n  <form>\n</div>\n", nil))

      schema, = server.messages.first

      assert_equal "schema", schema[:type]
      assert_equal [], schema[:diagnostics]
    end

    test "removing a clean file broadcasts nothing" do
      server = FakeServer.new

      pipeline(server).handle_event(event(:removed, "a.html.erb", "<p>Hi</p>", nil))

      assert_empty server.messages
    end

    test "recovering from a parse error without a compiler broadcasts a clearing schema" do
      server = FakeServer.new
      subject = pipeline(server)

      subject.handle_event(event(:changed, "a.html.erb", "<div></div>", "<div>\n  <form>\n</div>\n"))
      server.messages.clear
      subject.handle_event(event(:changed, "a.html.erb", "<div>\n  <form>\n</div>\n", "<div>\n  <form></form>\n</div>\n"))

      types = server.messages.map { |message, _| message[:type] }

      assert_includes types, "schema"
      assert_equal [], server.messages.find { |message, _| message[:type] == "schema" }.first[:diagnostics]
    end
  end
end
