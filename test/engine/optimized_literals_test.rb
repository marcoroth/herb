# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require "herb/engine/visitors/optimize_visitor"

module Engine
  class OptimizedLiteralsTest < Minitest::Spec
    include SnapshotUtils

    def optimize_options(**options)
      { visitors: [Herb::Engine::OptimizeVisitor.new], **options }
    end

    describe "what folds into text" do
      test "a string literal" do
        assert_compiled_snapshot(%(<p><%= "Total" %>: <%= count %></p>), optimize_options)
      end

      test "an integer literal" do
        assert_compiled_snapshot("<p><%= 1 %> of <%= count %></p>", optimize_options)
      end

      test "a float literal" do
        assert_compiled_snapshot("<p><%= 1.5 %> of <%= count %></p>", optimize_options)
      end

      test "a literal in a branch" do
        assert_compiled_snapshot(%(<% if flag %><%= "yes" %><% end %>), optimize_options)
      end

      test "a literal behind a statement modifier, inside the branch the parser unrolls it into" do
        assert_compiled_snapshot(%(<p><%= "yes" if flag %></p>), optimize_options)
      end

      test "a template left fully static collapses to the string it renders" do
        assert_compiled_snapshot(%(<h1><%= "hello" %></h1>), optimize_options)
      end

      test "a fully static template collapses with verify on, because a literal leaves nothing to verify" do
        assert_compiled_snapshot(%(<h1><%= "hello" %></h1>), visitors: [Herb::Engine::OptimizeVisitor.new(verify: true)])
      end
    end

    describe "how it escapes" do
      test "applies at compile time the escaping the renderer would have applied" do
        assert_compiled_snapshot(%(<p><%= "it's" %></p>), optimize_options(escape: true))
      end

      test "leaves raw output raw" do
        assert_compiled_snapshot(%(<p><%= "<b>bold</b>" %></p>), optimize_options)
      end

      test "honors the double equals indicator escaping when the engine does not" do
        assert_compiled_snapshot(%(<p><%== "<b>bold</b>" %></p>), optimize_options)
      end

      test "honors the double equals indicator staying raw when the engine escapes" do
        assert_compiled_snapshot(%(<p><%== "<b>bold</b>" %></p>), optimize_options(escape: true))
      end

      test "applies the attribute escape inside an attribute value" do
        assert_compiled_snapshot(%(<img alt="<%= "Herb's logo" %>">), optimize_options)
      end

      test "applies the JavaScript escape inside a script element" do
        assert_compiled_snapshot(%(<script>let text = "<%= "line\\nbreak" %>";</script>), optimize_options)
      end

      test "applies the CSS escape inside a style element" do
        assert_compiled_snapshot(%(<style>.a { color: <%= "red" %>; }</style>), optimize_options)
      end
    end

    describe "what stays dynamic" do
      test "an expression" do
        assert_compiled_snapshot("<p><%= greeting %></p>", optimize_options)
      end

      test "a string with interpolation" do
        assert_compiled_snapshot(%(<p><%= "a\#{b}" %></p>), optimize_options)
      end

      test "a literal in a trimming tag" do
        assert_compiled_snapshot(%(<p><%= "hi" -%>\ntail</p>), optimize_options)
      end

      test "a literal in a tag that spans lines" do
        assert_compiled_snapshot(%(<p><%=\n"hello" %></p>), optimize_options)
      end

      test "a literal that renders nothing" do
        assert_compiled_snapshot(%(<p><%= "" %></p>), optimize_options)
      end

      test "a value a swapped-out escape function might treat differently" do
        assert_compiled_snapshot(%(<p><%= "it's" %></p>), optimize_options(escape: true, escapefunc: "::CGI.escapeHTML"))
      end
    end

    describe "with a swapped-out escape function" do
      test "a value the stock function leaves untouched still folds" do
        assert_compiled_snapshot(%(<p><%= "hello" %></p>), optimize_options(escape: true, escapefunc: "::CGI.escapeHTML"))
      end
    end

    describe "what it renders" do
      test "renders what the expressions would have rendered" do
        assert_evaluated_snapshot(
          %(<p><%= "Total" %>: <%= count %> <%= "item" %><%= "s" if count != 1 %></p>),
          { count: 2 },
          optimize_options
        )
      end

      test "renders escaped text the way the renderer would have" do
        assert_evaluated_snapshot(
          %(<img alt="<%= "Herb's logo" %>" title="<%= title %>">),
          { title: "Herb" },
          optimize_options(escape: true)
        )
      end
    end
  end
end
