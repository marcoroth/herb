# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

# These tests are adapted from the erubi test suite at:
# https://github.com/jeremyevans/erubi/blob/master/test/test.rb
#
# Each test verifies that Herb::Engine produces the exact same evaluated output
# as Erubi::Engine for the given template and options.
module Engine
  class ErubiTestSuiteTest < Minitest::Spec
    include SnapshotUtils

    ERUBI_OPTS = { enforce_erubi_equality: true, enforce_actionview_erubi_equality: false }.freeze

    test "handles literal erb escape with double percent" do
      template = <<~'ERB'.chomp
        <table>
        <%% for item in @items %>
          <tr>
            <td><%# i+1 %></td>
            <td><%# item %></td>
          </tr>
          <%% end %>
        </table>
      ERB

      assert_evaluated_snapshot(template, { :@items => [2], i: 0 }, **ERUBI_OPTS)
    end

    test "double percent escapes erb tag" do
      template = "<%%= 'literal' %>"

      assert_evaluated_snapshot(template, {}, **ERUBI_OPTS)
    end

    test "double percent with equals escapes erb expression" do
      template = "<%%== 'literal' %>"

      assert_evaluated_snapshot(template, {}, **ERUBI_OPTS)
    end

    test "code tag with trailing content preserves whitespace" do
      template = "  <% x = 1 %> b\n<%= x %>"

      assert_evaluated_snapshot(template, {}, **ERUBI_OPTS)
    end

    test "trim false with code tags preserves whitespace" do
      template = "  <% x = 1 %>\n<%= x %>\n"

      assert_evaluated_snapshot(template, {}, trim: false, **ERUBI_OPTS)
    end

    test "trim false with comment tags preserves whitespace" do
      template = "  <%# comment %>\ntext\n"

      assert_evaluated_snapshot(template, {}, trim: false, **ERUBI_OPTS)
    end

    test "code tag with string containing erb-like content" do
      template = "<% x = '<%' %><%= x %>"

      assert_evaluated_snapshot(template, {}, **ERUBI_OPTS)
    end

    test "literal percent with different prefix and postfix" do
      template = <<~'ERB'.chomp
        <table>
          <%% for item in @items %>
          <tr>
          </tr>
          <%% end %>
          <%%= "literal" %>
        </table>
      ERB

      assert_evaluated_snapshot(
        template,
        { :@items => [2], i: 0 },
        literal_prefix: "{%",
        literal_postfix: "%}",
        **ERUBI_OPTS
      )
    end
  end
end
