# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

module Engine
  class WhitespaceTrimmingTest < Minitest::Spec
    include SnapshotUtils

    test "left trim removes preceding whitespace" do
      template = <<~ERB
        <%- if true %>
          <h1>Content</h1>
        <%- end %>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "right trim removes following newline" do
      template = <<~ERB
        <% if true -%>
          <h1>Content</h1>
        <% end -%>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "left and right trim" do
      template = <<~ERB
        <%- if true -%>
          <h1>Content</h1>
        <%- end -%>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "left trim with whitespace on previous line" do
      template = "before\n  <%- if true %>\nafter\n  <%- end %>\nfinal"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "right trim with whitespace on following line" do
      template = "before\n  <% if true -%>\nafter\n  <% end -%>\nfinal"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "left trim does not affect non-whitespace content" do
      template = "text<%- if true %>content<%- end %>"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "right trim does not affect non-newline content" do
      template = "<% if true -%>text<% end -%>more"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "multiple consecutive trimmed tags" do
      template = <<~ERB
        <%- if true -%>
        <%- if true -%>
          <h1>Content</h1>
        <%- end -%>
        <%- end -%>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "left trim with expressions" do
      template = <<~ERB
        <%- name = "World" %>
        Hello <%- name %>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "right trim with expressions" do
      template = <<~ERB
        <% name = "World" -%>
        Hello <%= name %>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "left and right trim with expressions" do
      template = <<~ERB
        <%- name = "World" -%>
        Hello <%- name -%>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "no trim preserves whitespace" do
      template = <<~ERB
        <% if true %>
          <h1>Content</h1>
        <% end %>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "trim with nested blocks" do
      template = <<~ERB
        <%- [1, 2, 3].each do |i| -%>
          <%- if i > 1 -%>
            <p><%- i -%></p>
          <%- end -%>
        <%- end -%>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "left trim at start of file" do
      template = "<%- if true %>\nContent\n<%- end %>"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "right trim at end of file" do
      template = "<% if true -%>\nContent\n<% end -%>"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "expression tag with right trim removes following newline" do
      template = "<%= \"hello\" -%>\nworld"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "expression tag with right trim inline" do
      template = "<%= \"hello\" -%> world"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "expression tag with right trim as no-op for newline control" do
      template = "2024-07-09 with the filters: \"archived:false\"<%= -%>.\n"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "inline space between close tag and ERB control tag is preserved" do
      template = "<strong>Foo:</strong> <% if true %>Bar<% end %>"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "whitespace between expression and code tag on same line is preserved" do
      template = "<%= value %> <% if true %>extra<% end %>"

      assert_evaluated_snapshot(template, { value: "hello." }, enforce_erubi_equality: true)
    end

    test "multiple spaces between expression and code tag on same line are preserved" do
      template = "<%= value %>   <% if true %>extra<% end %>"

      assert_evaluated_snapshot(template, { value: "hello." }, enforce_erubi_equality: true)
    end

    test "tab between expression and code tag on same line is preserved" do
      template = "<%= value %>\t<% if true %>extra<% end %>"

      assert_evaluated_snapshot(template, { value: "hello." }, enforce_erubi_equality: true)
    end

    test "whitespace between consecutive end tags after expression block is trimmed" do
      template = <<~ERB
        <% 1.times do %>
          <% form_tag("/t") do %>
            <%= tag.p do %>
              text
            <% end %>
          <% end %>
        <% end %>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, {}, enforce_actionview_erubi_equality: true)
    end
  end
end
