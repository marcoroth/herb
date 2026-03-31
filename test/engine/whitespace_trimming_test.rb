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
          <%= form_tag("/t") do %>
            <%= tag.p do %>
              text
            <% end %>
          <% end %>
        <% end %>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_actionview_snapshot(template)
    end

    test "whitespace between nested end tags after expression block is trimmed" do
      template = <<~ERB
        <% 1.times do %>
          <% 1.times do %>
            <%= tag.p do %>
              text
            <% end %>
          <% end %>
        <% end %>
      ERB

      assert_compiled_snapshot(template)
      assert_evaluated_actionview_snapshot(template)
    end

    test "output tag with -%> followed by indented control tag trims whitespace" do
      template = "A<%= -%>\n <% if true %>\nB\n<% end %>"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "output tag with -%> followed by non-indented control tag (baseline)" do
      template = "A<%= -%>\n<% if true %>\nB\n<% end %>"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "real-world pattern: text joined across conditional with -%>" do
      template = "  as of X<%= -%>\n  <% if true %>\n    with filters<%= -%>\n  <% end %>\n."

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "output tag with -%> same-line with control tag preserves space" do
      template = "A<%= -%> <% if true %>B<% end %>"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "output tag with -%> followed by else branch" do
      template = "<% if false %>\nX\n<%= -%>\n<% else %>\nY\n<% end %>"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "output tag with -%> followed by CRLF and control tag" do
      template = "A<%= -%>\r\n <% if true %>\r\nB\r\n<% end %>"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "output tag with -%> followed by another expression tag" do
      template = "A<%= -%>\n<%= \"B\" %>\n"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "leading whitespace before statement tag with inline content is preserved" do
      template = "<p>\n  <% if true %>text<% end %>\n</p>"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "leading whitespace before statement tag followed by newline is not preserved" do
      template = "<p>\n  <% if true %>\n    text\n  <% end %>\n</p>"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "leading whitespace before nested statement tags with inline content is preserved" do
      template = "<p>\n  <% if true %><% if true %>text<% end %><% end %>\n</p>"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "leading tabs before statement tag with inline content is preserved" do
      template = "<p>\n\t\t<% if true %>text<% end %>\n</p>"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "leading whitespace before statement tag with inline expression is preserved" do
      template = "<p>\n  <% if true %><%= \"text\" %><% end %>\n</p>"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "deeply nested statement tags with inline content" do
      template = "<p>\n  <% if true %><% if true %><% if true %>text<% end %><% end %><% end %>\n</p>"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "leading whitespace with else branch and inline content" do
      template = "<p>\n  <% if false %>nope<% else %>text<% end %>\n</p>"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "leading whitespace with elsif and inline content" do
      template = "<p>\n  <% if false %>nope<% elsif true %>text<% end %>\n</p>"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "expression before inline control tag on same line" do
      template = "<%= \"A\" %><% if true %>B<% end %>\n"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "control tag with right trim followed by inline content" do
      template = "<p>\n  <% if true -%>text<% end %>\n</p>"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "control tag with left trim and inline content" do
      template = "<p>\n  <%- if true %>text<% end %>\n</p>"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "multiple inline control tags on separate lines preserve their whitespace" do
      template = "<ul>\n  <% if true %>A<% end %>\n  <% if true %>B<% end %>\n</ul>"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "inline content after block expression" do
      template = "<p>\n  <%= [1].map { |x| x } %><% if true %>text<% end %>\n</p>"

      assert_compiled_snapshot(template)
      assert_evaluated_snapshot(template, enforce_erubi_equality: true)
    end

    test "multi-line code block preserves line count parity with erubi" do
      template = "<%\n  x = 1\n  y = 2\n%>\n<%= x %>"

      herb_engine = assert_compiled_snapshot(template)
      erubi_engine = Erubi::Engine.new(template)

      assert_equal erubi_engine.src.lines.count, herb_engine.src.lines.count,
        "Herb should preserve line count for multi-line code blocks.\n" \
        "  Erubi (#{erubi_engine.src.lines.count} lines): #{erubi_engine.src.inspect}\n" \
        "  Herb  (#{herb_engine.src.lines.count} lines): #{herb_engine.src.inspect}"
    end
  end
end
