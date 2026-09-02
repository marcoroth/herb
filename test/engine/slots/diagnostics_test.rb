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

      FLOAT_DEFAULT = "The state `rate` has a Float default. Ruby and JavaScript disagree on how to print a float, so the server and the client would render different text." #: String

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
            "The state `draft` has a Hash default. A state holds one value the client can write and read back.",
            "The state `tally` has an Array default. A list on the page is a collection of items, not one state holding many values."
          ],
          diagnostics.map(&:message)
        )
      end

      test "one template reports problems from unrelated parts of itself" do
        diagnostics, = report(THREE_FAMILIES)

        assert_equal ["herb-state-declaration", "herb-slots-name", "herb-state-compare"], diagnostics.map(&:code)

        assert_equal(
          [
            FLOAT_DEFAULT,
            "Two slots in the same scope are both named `body`. A slot name is an address, and two slots cannot share one.",
            "`sort == 3` compares the String state `sort` against an Integer literal, so it can never match."
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
        assert_equal "herb-state-declaration", diagnostic.code
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

        assert_equal ["herb-state-declaration", "herb-slots-name", "herb-state-compare"], recorded(src).map(&:code)
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
            "herb-state-declaration: #{FLOAT_DEFAULT}",
            "herb-state-declaration: The state `draft` has a Hash default. A state holds one value the client can write and read back.",
            "herb-state-declaration: The state `tally` has an Array default. A list on the page is a collection of items, not one state holding many values."
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

      NEAR_MISS = <<~ERB
        <%# herb:state (editing: false, body_draft: "") %>
        <div>
          <% if editing %>
            <textarea rows="2"><%= body_draft11 %></textarea>
          <% else %>
            <p>view</p>
          <% end %>
        </div>
      ERB

      test "a bare identifier one typo away from a state warns without degrading" do
        diagnostics, = report(NEAR_MISS)

        assert_equal 1, diagnostics.length

        warning = diagnostics.first

        assert_equal :warning, warning.severity
        assert_equal "herb-state-unknown", warning.code
        assert_equal "`body_draft11` reads like the state `body_draft` but is not declared, so the server owns it and the client can never fill it.", warning.message
        assert_equal 4, warning.location.start.line
      end

      test "helper calls, chains and unrelated identifiers stay silent" do
        ["body_draft", "sanitize(body)", "current_user_name", "message.body_draft1"].each do |expression|
          diagnostics, = report(<<~ERB)
            <%# herb:state (editing: false, body_draft: "") %>
            <div><span><%= #{expression} %></span></div>
          ERB

          assert_empty diagnostics
        end
      end

      MIXED_TEXTAREA = <<~ERB
        <%# herb:state (editing: false, body_draft: "") %>
        <div>
          <textarea data-chat-target="editor" rows="2"><%= body_draft %>11</textarea>
        </div>
      ERB

      test "an expression sharing a textarea with other text compiles to an interpolation" do
        visitor = Herb::Engine::Slots::Visitor.new(mode: :client, fatal: false)

        Herb::Engine.new(MIXED_TEXTAREA, visitors: [visitor], filename: "app/views/test.html.erb")

        assert_equal ["herb-state-binding"], visitor.diagnostics.map(&:code)
        assert_equal [:raw_text_interpolation], visitor.slots.map(&:type)
        assert_equal({ "0" => ["", "11"] }, visitor.manifest["parts"])
        assert_equal({ "body_draft" => [0] }, visitor.manifest["states"]["reads"])
      end

      test "a state mixed into a form control's value warns that it cannot bind" do
        diagnostics, = report(<<~ERB)
          <%# herb:state (body_draft: "") %>
          <input value="<%= body_draft %>blahblah">
        ERB

        assert_equal 1, diagnostics.length
        assert_equal :warning, diagnostics.first.severity
        assert_equal "herb-state-binding", diagnostics.first.code
        assert_equal "`body_draft` shares this `<input>`'s `value` with other text, so typing here will not write the state back. State writes still update the whole `value`.", diagnostics.first.message
      end

      test "mixes that never bound stay silent" do
        [
          %(<input value="<%= body_draft %>">),
          %(<div class="<%= body_draft %>x"></div>),
          %(<input value="<%= message.author %>x">)
        ].each do |element|
          diagnostics, = report(<<~ERB)
            <%# herb:state (body_draft: "") %>
            #{element}
          ERB

          assert_empty diagnostics
        end
      end

      test "a lone or whitespace-framed textarea expression stays a plain content slot" do
        [
          "<textarea><%= body_draft %></textarea>",
          "<textarea>\n    <%= body_draft %>\n  </textarea>"
        ].each do |element|
          visitor = Herb::Engine::Slots::Visitor.new(mode: :client, fatal: false)

          Herb::Engine.new(MIXED_TEXTAREA.sub(%(<textarea data-chat-target="editor" rows="2"><%= body_draft %>11</textarea>), element), visitors: [visitor], filename: "app/views/test.html.erb")

          assert_empty visitor.diagnostics
          assert_equal [:raw_text], visitor.slots.map(&:type)
        end
      end

      test "two state reads in one textarea cannot share the content" do
        diagnostics, = report(MIXED_TEXTAREA.sub("<%= body_draft %>11", "<%= body_draft %><%= editing %>"))

        assert_equal 1, diagnostics.length
        assert_equal :error, diagnostics.first.severity
        assert_equal "herb-state-read", diagnostics.first.code
        assert_equal "`body_draft` reads a state inside a `<textarea>` that mixes other dynamic parts. A state write cannot supply the other values.", diagnostics.first.message
      end

      test "content that parts cannot express warns and keeps the slot off" do
        diagnostics, = report(MIXED_TEXTAREA.sub("<%= body_draft %>11", "<%= body_draft %><% x = 1 %>11"))

        assert_equal 1, diagnostics.length
        assert_equal :warning, diagnostics.first.severity
        assert_equal "herb-slots-content", diagnostics.first.code
        assert_equal "`<%= body_draft %>` shares the `<textarea>` content with other text. The client writes this content as one piece and would discard the rest, so the expression stays server-rendered and never updates.", diagnostics.first.message
      end

      CLIENT_BRANCH = <<~ERB
        <%# herb:state (editing: false, body_draft: "") %>
        <div>
          <% if editing %>
            <span><%= message.sent_label %></span>
            <p><%= body_draft %></p>
          <% end %>
          <em><%= message.author %></em>
        </div>
      ERB

      test "a server value inside a client branch warns while state reads and top-level values stay silent" do
        diagnostics, = report(CLIENT_BRANCH)

        assert_equal 1, diagnostics.length

        warning = diagnostics.first

        assert_equal :warning, warning.severity
        assert_equal "herb-slots-branch", warning.code
        assert_equal "`<%= message.sent_label %>` sits inside a branch the client can show on its own, but its value comes from the server. The server only computes values for the branch it renders, so showing this branch ahead of the server leaves the value empty.", warning.message
        assert_equal 4, warning.location.start.line
      end

      test "a server-driven conditional keeps its branches silent" do
        diagnostics, = report(CLIENT_BRANCH.sub("<% if editing %>", "<% if message.editable? %>"))

        assert_empty diagnostics
      end

      test "a computed boolean attribute on a form control warns that it cannot bind" do
        diagnostics, = report(<<~ERB)
          <%# herb:state (agreed: true, unread: 0) %>
          <%= tag.input type: "checkbox", checked: unread > 3 %>
        ERB

        assert_equal 1, diagnostics.length
        assert_equal :warning, diagnostics.first.severity
        assert_equal "herb-state-binding", diagnostics.first.code
        assert_equal "`checked` on this `<input>` follows `unread > 3`, so using the control cannot write a state back. The attribute still updates when the states change.", diagnostics.first.message
      end

      test "bare and off-control boolean attributes stay silent" do
        [
          %(<%= tag.input type: "checkbox", checked: agreed %>),
          %(<%= tag.input type: "checkbox", checked: agreed? %>),
          %(<%= tag.button "Send", disabled: unread > 3 %>)
        ].each do |element|
          diagnostics, = report(<<~ERB)
            <%# herb:state (agreed: true, unread: 0) %>
            #{element}
          ERB

          assert_empty diagnostics
        end
      end

      test "a control whose listener already writes the state stays silent" do
        [
          <<~HTML,
            <select data-herb-set="change->filter=$value">
              <option value="all" selected="<%= filter == "all" %>">All</option>
            </select>
          HTML
          %(<input type="checkbox" data-herb-set="unread=0" checked="<%= unread > 3 %>">),
          %(<textarea data-herb-set="input->body_draft=$value"><%= body_draft %>11</textarea>)
        ].each do |element|
          diagnostics, = report(<<~ERB)
            <%# herb:state (filter: "all", unread: 0, body_draft: "") %>
            #{element}
          ERB

          assert_empty diagnostics
        end
      end

      test "a listener writing a different state does not excuse the control" do
        diagnostics, = report(<<~ERB)
          <%# herb:state (filter: "all", unread: 0) %>
          <input type="checkbox" data-herb-set="filter=all" checked="<%= unread > 3 %>">
        ERB

        assert_equal ["herb-state-binding"], diagnostics.map(&:code)
      end

      test "a state condition mixed into a boolean attribute is refused" do
        diagnostics, = report(<<~ERB)
          <%# herb:state (draft: "") %>
          <button data-herb-reset="draft" hidden="<%= draft == "" %>111">x</button>
        ERB

        assert_equal 1, diagnostics.length
        assert_equal :error, diagnostics.first.severity
        assert_equal "herb-state-read", diagnostics.first.code
        assert_equal "`hidden` on this `<button>` mixes `draft == \"\"` with other text. A boolean attribute follows presence and any value keeps it present, so it could never turn off.", diagnostics.first.message
      end

      test "whole-value and non-state boolean attributes stay silent" do
        [
          %(<button hidden="<%= draft == "" %>">x</button>),
          %(<button hidden="<%= @x %>111">x</button>)
        ].each do |element|
          diagnostics, = report(<<~ERB)
            <%# herb:state (draft: "") %>
            #{element}
          ERB

          assert_empty diagnostics
        end
      end
    end
  end
end
