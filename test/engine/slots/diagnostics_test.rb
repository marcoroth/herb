# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/engine/slots/visitor"
require_relative "../../../lib/herb/engine/runtime/session"

module Engine
  module Slots
    class DiagnosticsTest < Minitest::Spec
      include SnapshotUtils

      FLOAT_DEFAULT = "The state `rate` has a Float default. Ruby and JavaScript disagree on how to print a float, so declare it as an Integer or a String instead." #: String

      THREE_BAD_STATES = <<~ERB
        <h1>Report</h1>
        <%# herb:state (rate: 1.0, draft: { title: "" }, tally: []) %>
        <div><%= rate %><%= draft %><%= tally %></div>
      ERB

      THREE_FAMILIES = <<~ERB
        <%# herb:state (rate: 1.0, sort: "name") %>
        <div><% if sort == 3 %>a<% end %></div>
        <p data-herb-name="body"><%= @a %></p>
        <p data-herb-name="body"><%= @b %></p>
      ERB

      LOCAL_COLLISION = <<~ERB
        <%# locals: (open: false) %>
        <%# herb:state (title: "x", open: false) %>
        <div><%= open %></div>
      ERB

      SECOND_LINE_DIRECTIVE = <<~ERB
        <h1>Report</h1>
        <%# herb:state (open: false, rate: 1.0) %>
        <div><%= rate %></div>
      ERB

      TWO_DIRECTIVES = <<~ERB
        <div>Report</div>
        <%# herb:state (open: false, rate: 1.0) %>
        <div><%= open %><%= rate %></div>
      ERB

      def options
        { visitors: [Herb::Engine::Slots::Visitor.new(mode: :client, fatal: false)], filename: "app/views/test.html.erb" }
      end

      def report(template)
        visitor = Herb::Engine::Slots::Visitor.new(mode: :client, fatal: false)
        engine = Herb::Engine.new(template, visitors: [visitor], filename: "app/views/test.html.erb")

        [visitor.diagnostics, engine.src]
      end

      def recorded(src)
        session = Herb::Engine::Runtime::Session.open

        begin
          evaluate_herb_source(src, {})

          session.report.diagnostics
        ensure
          Herb::Engine::Runtime::Session.close
        end
      end

      def at(diagnostic)
        [diagnostic.location.start.line, diagnostic.location.start.column]
      end

      def spelled(template, diagnostic)
        location = diagnostic.location

        template.lines[location.start.line - 1].to_s[location.start.column...location.end.column]
      end

      test "one directive reports every state it got wrong" do
        diagnostics, = report(THREE_BAD_STATES)

        assert_equal(
          [
            FLOAT_DEFAULT,
            "The state `draft` has a Hash default. Declare each leaf as its own state, like `(draft_title: \"\")`.",
            "The state `tally` has an Array default. A list on the page is a collection of items, so declare an item-scoped boolean inside the loop instead."
          ],
          diagnostics.map(&:message)
        )
      end

      test "one template reports problems from unrelated parts of itself" do
        diagnostics, = report(THREE_FAMILIES)

        assert_equal ["slots-declaration", "slots-name", "slots-compare"], diagnostics.map(&:code)

        assert_equal(
          [
            FLOAT_DEFAULT,
            "Two slots in the same scope are both named `body`. A slot name is an address, so give one of them a different name.",
            "`sort == 3` compares the String state `sort` against an Integer literal, so it can never match. Compare it against a String literal instead."
          ],
          diagnostics.map(&:message)
        )
      end

      test "an expression that fails for a reason is not also called computed" do
        diagnostics, = report(%(<%# herb:state (sort: "name") %><div><% if sort == 3 %>a<% end %></div>))

        assert_equal 1, diagnostics.size
      end

      test "each diagnostic points at the directive it came from" do
        diagnostics, = report(TWO_DIRECTIVES)

        assert_equal([[2, 35]], diagnostics.map { |diagnostic| at(diagnostic) })
      end

      test "a name points at the attribute that spelled it" do
        diagnostics, = report(%(<h1>Title</h1>\n<p data-herb-name="pair"><%= @first %> and <%= @second %></p>))

        assert_equal([[2, 3]], diagnostics.map { |diagnostic| at(diagnostic) })
      end

      test "records them against the template, at compile time, as errors" do
        diagnostics, = report(THREE_BAD_STATES)
        diagnostic = diagnostics.first

        assert_equal "app/views/test.html.erb", diagnostic.template
        assert_equal :error, diagnostic.severity
        assert_equal :compile, diagnostic.phase
        assert_equal "slots-declaration", diagnostic.code
      end

      test "hands the page its findings so they reach the browser" do
        _, src = report(THREE_BAD_STATES)
        session = Herb::Engine::Runtime::Session.open

        begin
          evaluate_herb_source(src, {})

          assert_equal [FLOAT_DEFAULT], session.report.diagnostics.map(&:message).first(1)
        ensure
          Herb::Engine::Runtime::Session.close
        end
      end

      test "findings from different families both reach the page" do
        _, src = report(THREE_FAMILIES)

        assert_equal ["slots-declaration", "slots-name", "slots-compare"], recorded(src).map(&:code)
      end

      test "findings of one family on one line reach the page as one" do
        _, src = report(THREE_BAD_STATES)

        assert_equal 1, recorded(src).size
      end

      test "a template it refused still renders on the server" do
        assert_evaluated_snapshot(THREE_BAD_STATES, {}, options)
      end

      test "a state it refused still answers the reads that follow it" do
        _, src = report(%(<%# herb:state (rate: 1.0) %><div><% if rate %>a<% else %>b<% end %></div>))

        assert_equal "<!--herb-region:app/views/test.html.erb:bdc3b983:0--><div>a</div><!--/herb-region:app/views/test.html.erb-->", evaluate_herb_source(src, {})
      end

      test "a fatal visitor refuses to compile, and shows the source it refused" do
        error = assert_raises(Herb::Engine::CompilationError) do
          Herb::Engine.new(THREE_BAD_STATES, visitors: [Herb::Engine::Slots::Visitor.new(mode: :client)], filename: "app/views/test.html.erb")
        end

        shown = error.detailed_message.gsub(/\e\[[0-9;]*m/, "")

        assert_equal ["app/views/test.html.erb:2:23:", "app/views/test.html.erb:2:35:", "app/views/test.html.erb:2:57:"], shown.scan(%r{app/views/test\.html\.erb:\d+:\d+:}).uniq
        assert_equal(
          [
            "slots-declaration: #{FLOAT_DEFAULT}",
            "slots-declaration: The state `draft` has a Hash default. Declare each leaf as its own state, like `(draft_title: \"\")`.",
            "slots-declaration: The state `tally` has an Array default. A list on the page is a collection of items, so declare an item-scoped boolean inside the loop instead."
          ],
          error.diagnostics.map { |diagnostic| "#{diagnostic.code}: #{diagnostic.message}" }
        )
      end

      test "a fatal visitor is what a caller gets without asking" do
        assert_predicate Herb::Engine::Slots::Visitor.new(mode: :client), :fatal?
      end

      test "a template it accepts reports nothing" do
        diagnostics, = report(%(<%# herb:state (open: false) %><div><% if open %>a<% else %>b<% end %></div>))

        assert_empty diagnostics
      end

      test "a diagnostic points at the default it refused, not the whole directive" do
        diagnostics, = report(THREE_BAD_STATES)

        assert_equal([[2, 22], [2, 34], [2, 56]], diagnostics.map { |diagnostic| at(diagnostic) })
        assert_equal(["1.0", "{ title: \"\" }", "[]"], diagnostics.map { |diagnostic| spelled(THREE_BAD_STATES, diagnostic) })
      end

      test "a diagnostic about the name points at the name it refused" do
        diagnostics, = report(LOCAL_COLLISION)

        assert_equal([[2, 28]], diagnostics.map { |diagnostic| at(diagnostic) })
        assert_equal(["open"], diagnostics.map { |diagnostic| spelled(LOCAL_COLLISION, diagnostic) })
      end

      test "a diagnostic below the first line points at the line it came from" do
        diagnostics, = report(SECOND_LINE_DIRECTIVE)

        assert_equal([[2, 35]], diagnostics.map { |diagnostic| at(diagnostic) })
        assert_equal(["1.0"], diagnostics.map { |diagnostic| spelled(SECOND_LINE_DIRECTIVE, diagnostic) })
      end
    end
  end
end
