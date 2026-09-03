# frozen_string_literal: true

require "tmpdir"
require "fileutils"

require_relative "../test_helper"
require_relative "../../lib/herb/dev/runner"
require_relative "../../lib/herb/dev"

module Dev
  class RunnerTest < Minitest::Spec
    class FakeWebSocket
      attr_reader :messages #: Array[Hash[Symbol, untyped]]

      def initialize
        @messages = []
      end

      def client_count
        1
      end

      def broadcast(message, **)
        @messages << message
      end
    end

    BROKEN = "<div>\n  <form>\n</div>\n" #: String

    def broadcast_for(current_content, previous_content)
      websocket = FakeWebSocket.new
      pipeline = Herb::Dev::Pipeline.new(server: websocket, compiler: -> {})

      event = Herb::Dev::Watcher::Event.new(
        kind: :changed,
        path: "/app/views/posts/index.html.erb",
        relative_path: "app/views/posts/index.html.erb",
        previous: previous_content,
        current: current_content
      )

      capture_io { pipeline.handle_event(event) }

      websocket.messages.first
    end

    test "names the parser as what found the error, not itself as what delivered it" do
      error = broadcast_for(BROKEN, "")[:errors].first
      parsed = Herb.parse(BROKEN, strict: true, analyze: true).errors.first.to_diagnostic(template: "app/views/posts/index.html.erb")

      assert_equal "Herb Parser", error[:origin]
      assert_equal parsed.origin, error[:origin]
    end

    test "sends the code and suggestion the same error would carry off the page" do
      error = broadcast_for(BROKEN, "")[:errors].first
      parsed = Herb.parse(BROKEN, strict: true, analyze: true).errors.first.to_diagnostic(template: "app/views/posts/index.html.erb")

      assert_equal parsed.code, error[:code]
      assert_equal parsed.suggestion, error[:suggestion]
      assert_equal parsed.message, error[:message]
    end

    test "sends the whole file with the errors, so the panel can highlight it" do
      assert_equal BROKEN, broadcast_for(BROKEN, "")[:source]
    end

    test "sends the content it just read, not the content it replaced" do
      assert_equal BROKEN, broadcast_for(BROKEN, "<div>\n</div>\n")[:source]
    end

    test "a fixed file broadcasts a clearing schema and never a fixed message" do
      websocket = FakeWebSocket.new
      pipeline = Herb::Dev::Pipeline.new(server: websocket, compiler: -> {})

      broken = Herb::Dev::Watcher::Event.new(kind: :changed, path: "/a", relative_path: "a.html.erb", previous: "<div></div>", current: BROKEN)
      fixed = Herb::Dev::Watcher::Event.new(kind: :changed, path: "/a", relative_path: "a.html.erb", previous: BROKEN, current: "<div>\n  <form></form>\n</div>\n")

      capture_io do
        pipeline.handle_event(broken)
        pipeline.handle_event(fixed)
      end

      types = websocket.messages.map { |message| message[:type] }

      refute_includes types, "fixed"
      assert_includes types, "schema"

      schema = websocket.messages.find { |message| message[:type] == "schema" }

      assert_equal [], schema[:diagnostics]
    end

    test "text_changed is patchable" do
      diff_result = Herb.diff("<div>Hello</div>", "<div>World</div>")

      assert Herb::Dev::Runner.can_patch?(diff_result.operations)
      assert_equal 1, diff_result.operation_count
      assert_equal :text_changed, diff_result.operations[0].type
    end

    test "attribute_value_changed is patchable" do
      diff_result = Herb.diff('<div class="old">Content</div>', '<div class="new">Content</div>')

      assert Herb::Dev::Runner.can_patch?(diff_result.operations)
      assert_equal 1, diff_result.operation_count
      assert_equal :attribute_value_changed, diff_result.operations[0].type
    end

    test "attribute_added is patchable" do
      diff_result = Herb.diff("<div>Content</div>", '<div id="main">Content</div>')

      assert Herb::Dev::Runner.can_patch?(diff_result.operations)
      assert_equal 1, diff_result.operation_count
      assert_equal :attribute_added, diff_result.operations[0].type
    end

    test "attribute_removed is patchable" do
      diff_result = Herb.diff('<div id="main">Content</div>', "<div>Content</div>")

      assert Herb::Dev::Runner.can_patch?(diff_result.operations)
      assert_equal 1, diff_result.operation_count
      assert_equal :attribute_removed, diff_result.operations[0].type
    end

    test "node_inserted triggers reload" do
      diff_result = Herb.diff("<div></div>", "<div><span>New</span></div>")

      refute Herb::Dev::Runner.can_patch?(diff_result.operations)
    end

    test "node_removed triggers reload" do
      diff_result = Herb.diff("<div><span>Old</span></div>", "<div></div>")

      refute Herb::Dev::Runner.can_patch?(diff_result.operations)
    end

    test "erb_content_changed triggers reload" do
      diff_result = Herb.diff("<%= foo %>", "<%= bar %>")

      refute Herb::Dev::Runner.can_patch?(diff_result.operations)
    end

    test "inserting ERB node triggers reload" do
      diff_result = Herb.diff("<div>Hello</div>", "<div><%= name %></div>")

      refute Herb::Dev::Runner.can_patch?(diff_result.operations)
    end

    test "identical templates produce no operations" do
      diff_result = Herb.diff("<div>Hello</div>", "<div>Hello</div>")

      assert diff_result.identical?
      assert_equal 0, diff_result.operation_count
    end

    test "multiple patchable operations are all patchable" do
      diff_result = Herb.diff('<div class="old">Hello</div>', '<div class="new">World</div>')

      assert Herb::Dev::Runner.can_patch?(diff_result.operations)
      assert_equal 2, diff_result.operation_count
    end

    test "mixed patchable and non-patchable triggers reload" do
      diff_result = Herb.diff('<div class="old">Hello</div>', '<div class="new">Hello</div><span>New</span>')

      refute Herb::Dev::Runner.can_patch?(diff_result.operations)
    end

    test "indexing writes no cursor escapes when stdout is not a terminal" do
      directory = Dir.mktmpdir("herb_dev_runner_test")

      File.write(File.join(directory, "index.html.erb"), "<div>Hello</div>\n")

      config = Herb::Configuration.load(directory)

      watcher = Herb::Dev::Watcher.new(config: config, root: directory) { |event| event }

      output, = capture_io do
        Herb::Dev::Runner.new(path: directory).send(:index_files, watcher)
      end

      assert_equal "  Files:     1 template indexed\n", output
    ensure
      FileUtils.rm_rf(directory)
      Herb.reset_configuration!
    end

    def paint_error(previous, current, broken: [])
      runner = Herb::Dev::Runner.new
      runner.instance_variable_set(:@broken_files, Set.new(broken))

      classification = Herb::Dev::Classifier.new.call(previous, current)

      event = Herb::Dev::Watcher::Event.new(
        kind: :changed,
        path: "/app/views/posts/index.html.erb",
        relative_path: "app/views/posts/index.html.erb",
        previous: previous,
        current: current
      )

      output, = capture_io do
        runner.send(:paint_change, event, classification, "12:00:00", "index.html.erb")
      end

      output
    end

    test "prints the diagnostic with its source context and suggestion" do
      output = paint_error("", BROKEN)

      expected = [
        "    12:00:00 \u2717 error  \u2718 [MissingClosingTagError] Opening tag `<form>` at (2:3) doesn't have a matching closing tag `</form>` in the same scope.",
        "",
        "      app/views/posts/index.html.erb:2:3:",
        "        2 \u2502   <form>",
        "          \u2575   ~~~~~~",
        "",
        "    Add the closing tag, or make it self-closing.",
        "",
        ""
      ].join("\n")

      assert_equal expected, output
    end

    test "logs nothing when the template still carries only errors it already reported" do
      assert_equal "", paint_error(BROKEN, "<div id=\"x\">\n  <form>\n</div>\n")
    end

    test "a template indexed as broken paints clear without a diff against the source that never parsed" do
      output = paint_error(BROKEN, "<div>\n  <form></form>\n</div>\n", broken: ["app/views/posts/index.html.erb"])

      assert_equal "    12:00:00 \u2713 clear   index.html.erb\n\n", output
    end

    test "indexing counts the templates that do not parse" do
      directory = Dir.mktmpdir("herb_dev_runner_test")

      File.write(File.join(directory, "good.html.erb"), "<div>Hello</div>\n")
      File.write(File.join(directory, "broken.html.erb"), BROKEN)

      config = Herb::Configuration.load(directory)
      watcher = Herb::Dev::Watcher.new(config: config, root: directory) { |event| event }

      output, = capture_io do
        Herb::Dev::Runner.new(path: directory).send(:index_files, watcher)
      end

      assert_equal "  Files:     2 templates indexed, 1 doesn't parse\n", output
      assert_equal ["broken.html.erb"], watcher.broken_files.to_a
    ensure
      FileUtils.rm_rf(directory)
      Herb.reset_configuration!
    end

    test "a template remembered as broken broadcasts a clearing schema when it is repaired" do
      websocket = FakeWebSocket.new
      pipeline = Herb::Dev::Pipeline.new(server: websocket, compiler: -> {})
      pipeline.remember_broken(["a.html.erb"])

      fixed = Herb::Dev::Watcher::Event.new(kind: :changed, path: "/a", relative_path: "a.html.erb", previous: BROKEN, current: "<div>\n  <form></form>\n</div>\n")

      capture_io { pipeline.handle_event(fixed) }

      assert_equal(["schema", "invalidate"], websocket.messages.map { |message| message[:type] })
    end

    test "a template remembered as broken stays on the list until it is repaired" do
      websocket = FakeWebSocket.new
      pipeline = Herb::Dev::Pipeline.new(server: websocket, compiler: -> {})
      pipeline.remember_broken(["a.html.erb"])

      assert_equal ["a.html.erb"], pipeline.broken_files

      fixed = Herb::Dev::Watcher::Event.new(kind: :changed, path: "/a", relative_path: "a.html.erb", previous: BROKEN, current: "<div>\n  <form></form>\n</div>\n")

      capture_io { pipeline.handle_event(fixed) }

      assert_equal [], pipeline.broken_files
    end

    test "a repeated event for unchanged content emits nothing from the watcher" do
      directory = Dir.mktmpdir("herb_dev_runner_test")
      path = File.join(directory, "index.html.erb")

      File.write(path, BROKEN)

      config = Herb::Configuration.load(directory)
      events = []
      watcher = Herb::Dev::Watcher.new(config: config, root: directory) { |event| events << event }

      watcher.index

      raw = Struct.new(:kind, :path).new("modified", path)

      watcher.send(:handle, raw)
      watcher.send(:handle, raw)

      assert_empty events
    ensure
      FileUtils.rm_rf(directory)
      Herb.reset_configuration!
    end

    test "an error already reported is not repeated when a new one joins it" do
      broken_once = "<div>\n  <form>\n</div>\n"
      broken_twice = "<div>\n  <form>\n  <span>\n</div>\n"

      output = paint_error(broken_once, broken_twice)

      expected = [
        "    12:00:00 \u2717 error  \u2718 [MissingClosingTagError] Opening tag `<span>` at (3:3) doesn't have a matching closing tag `</span>` in the same scope.",
        "",
        "      app/views/posts/index.html.erb:3:3:",
        "        3 \u2502   <span>",
        "          \u2575   ~~~~~~",
        "",
        "    Add the closing tag, or make it self-closing.",
        "",
        ""
      ].join("\n")

      assert_equal expected, output
    end
  end
end
