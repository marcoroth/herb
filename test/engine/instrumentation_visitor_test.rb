# frozen_string_literal: true

require_relative "../test_helper"
require "herb/engine/instrumentation_visitor"

module Engine
  class InstrumentationVisitorTest < Minitest::Spec
    include SnapshotUtils

    FILENAME = "app/views/test.html.erb"

    RENDERS = {
      "a partial" => %(<%= render "posts/card" %>),
      "a collection" => %(<%= render partial: "card", collection: @posts %>),
      "a layout" => %(<%= render layout: "box" do %>inner<% end %>),
      "a template" => %(<%= render template: "posts/show" %>),
      "an object, which only Rails can classify" => %(<%= render @post %>),
    }.freeze

    SOURCES = {
      "plain output" => "<div><%= 1 + 1 %></div>",
      "a block" => "<% [1, 2].each do |n| %><%= n %><% end %>",
      "an assignment carried to a later tag" => "<% total = 40 + 2 %><%= total %>",
      "an output assignment" => "<%= total = 7 %>",
      "a conditional" => "<% if true %>yes<% else %>no<% end %>",
      "a comment" => "<%# ignored %>ok",
      "markup around a tag" => "<p>before</p><%= 1 %><p>after</p>",
    }.freeze

    def instrumented(source)
      assert_compiled_snapshot(source, filename: FILENAME, visitors: [Herb::Engine::InstrumentationVisitor.new])
    end

    def compile(source, instrument: true)
      visitors = instrument ? [Herb::Engine::InstrumentationVisitor.new] : []

      Herb::Engine.new(source, filename: FILENAME, visitors: visitors).src
    end

    def render(source, instrument: true)
      Object.new.instance_eval(compile(source, instrument: instrument))
    end

    describe "what it emits" do
      test "wraps an output tag" do
        instrumented("<div><%= title %></div>")
      end

      test "frames a block rather than wrapping it" do
        instrumented("<% items.each do |item| %><%= item %><% end %>")
      end

      test "frames an assignment rather than wrapping it" do
        instrumented("<%= total = 1 %>")
      end

      test "opens and closes around a statement" do
        instrumented("<% total = 1 %>")
      end

      test "leaves a comment alone" do
        instrumented("<%# nothing to see %>")
      end

      test "reaches into a conditional" do
        instrumented("<% if admin? %><%= secret %><% end %>")
      end
    end

    describe "what it must not change" do
      SOURCES.each do |name, source|
        test "renders #{name} the same as an uninstrumented template" do
          assert_equal render(source, instrument: false), render(source)
        end
      end
    end

    describe "what it attributes" do
      def observed(source)
        compiled = compile(source)

        session = Herb::Engine::Report::Session.capture do
          Object.new.instance_eval(compiled)
        end

        session.entries
      end

      def self.watching_object
        Object.new.tap do |object|
          object.define_singleton_method(:watch) do |value|
            Herb::Engine::Report::Session.observe(:seen, value)
            value
          end
        end
      end

      test "puts what happened under the tag that caused it" do
        source = "<div><%= watch(1) %></div>\n<%= watch(2) %>"
        compiled = compile(source)

        session = Herb::Engine::Report::Session.capture do
          self.class.watching_object.instance_eval(compiled)
        end

        assert_equal([[1, 5], [2, 0]], session.entries.map { |entry| [entry.line, entry.column] })
        assert_equal([[1], [2]], session.entries.map { |entry| entry[:seen] })
      end

      test "names the template it came from" do
        source = "<%= watch(1) %>"
        compiled = compile(source)

        session = Herb::Engine::Report::Session.capture do
          self.class.watching_object.instance_eval(compiled)
        end

        assert_equal [FILENAME], session.entries.map(&:template)
      end

      test "reaches the payload as a metric naming the tag that caused it" do
        source = "<ul>\n  <% [1, 2].each do |n| %>\n    <li><%= watch(n) %></li>\n  <% end %>\n</ul>"
        compiled = compile(source)

        session = Herb::Engine::Report::Session.capture do
          self.class.watching_object.instance_eval(compiled)
        end

        session.measure(:seen, origin: "Herb Engine", code: "sql-queries") { |seen|
          "#{seen.size} SQL queries"
        }

        diagnostic = session.diagnostics.first

        assert_equal "#{FILENAME}:3:9: [sql-queries] 2 SQL queries", diagnostic.to_s
        assert_equal :metric, diagnostic.kind
      end

      test "collects every pass of a loop under the one tag that repeats" do
        source = "<% [1, 2, 3].each do |n| %><%= watch(n) %><% end %>"
        compiled = compile(source)

        session = Herb::Engine::Report::Session.capture do
          self.class.watching_object.instance_eval(compiled)
        end

        seen = session.entries.find { |entry| entry[:seen].any? }

        assert_equal [1, 2, 3], seen[:seen]
      end
    end

    describe "what it attributes a render to" do
      test "frames the whole template as one render" do
        compiled = compile("<div><%= 1 + 1 %></div>")

        session = Herb::Engine::Report::Session.capture { Object.new.instance_eval(compiled) }

        assert_equal [{ id: "1", template: FILENAME }], session.report.render_tree
      end

      test "gives an annotation made while it renders that render's node" do
        compiled = compile("<%= annotated %>")
        object = Object.new

        object.define_singleton_method(:annotated) do
          Herb::Engine::Report::Session.annotate(:render_time, 2.5, origin: "reactionview")
          "x"
        end

        session = Herb::Engine::Report::Session.capture { object.instance_eval(compiled) }

        assert_equal({ "1" => { "reactionview" => { render_time: 2.5 } } }, session.report.nodes)
      end

      test "leaves the render open for locals the template assigns afterwards" do
        assert_equal render("<% total = 40 + 2 %><%= total %>", instrument: false), render("<% total = 40 + 2 %><%= total %>")
      end
    end

    describe "what it says a render was reached by" do
      RENDERS.each do |name, source|
        test "frames #{name}" do
          instrumented(source)
        end
      end

      test "frames a render tag at all" do
        assert_includes compile(%(<%= render "posts/card" %>)), "Session.at"
      end

      test "keeps the body of a render that takes a block" do
        assert_includes compile(%(<%= render layout: "box" do %>inner<% end %>)), "inner"
      end
    end
  end
end
