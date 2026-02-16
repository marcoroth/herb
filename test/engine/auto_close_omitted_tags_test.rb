# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"

module Engine
  class AutoCloseOmittedTagsTest < Minitest::Spec
    include SnapshotUtils

    test "p element without closing tag - auto_close disabled (default) - compilation" do
      template = "<p>Hello World"

      assert_compiled_snapshot(template, strict: false, auto_close_omitted_tags: false, escape: false)
    end

    test "p element without closing tag - auto_close disabled (default) - render" do
      template = "<p>Hello World"

      assert_evaluated_snapshot(template, {}, { strict: false, auto_close_omitted_tags: false, escape: false })
    end

    test "p element without closing tag - auto_close enabled - compilation" do
      template = "<p>Hello World"

      assert_compiled_snapshot(template, strict: false, auto_close_omitted_tags: true, escape: false)
    end

    test "p element without closing tag - auto_close enabled - render" do
      template = "<p>Hello World"

      assert_evaluated_snapshot(template, {}, { strict: false, auto_close_omitted_tags: true, escape: false })
    end

    test "multiple p elements without closing tags - auto_close enabled - compilation" do
      template = "<p>First<p>Second<p>Third"

      assert_compiled_snapshot(template, strict: false, auto_close_omitted_tags: true, escape: false)
    end

    test "multiple p elements without closing tags - auto_close enabled - render" do
      template = "<p>First<p>Second<p>Third"

      assert_evaluated_snapshot(template, {}, { strict: false, auto_close_omitted_tags: true, escape: false })
    end

    test "li elements without closing tags - auto_close disabled - compilation" do
      template = "<ul><li>One<li>Two</ul>"

      assert_compiled_snapshot(template, strict: false, auto_close_omitted_tags: false, escape: false)
    end

    test "li elements without closing tags - auto_close disabled - render" do
      template = "<ul><li>One<li>Two</ul>"

      assert_evaluated_snapshot(template, {}, { strict: false, auto_close_omitted_tags: false, escape: false })
    end

    test "li elements without closing tags - auto_close enabled - compilation" do
      template = "<ul><li>One<li>Two</ul>"

      assert_compiled_snapshot(template, strict: false, auto_close_omitted_tags: true, escape: false)
    end

    test "li elements without closing tags - auto_close enabled - render" do
      template = "<ul><li>One<li>Two</ul>"

      assert_evaluated_snapshot(template, {}, { strict: false, auto_close_omitted_tags: true, escape: false })
    end

    test "dt and dd elements without closing tags - auto_close enabled - compilation" do
      template = "<dl><dt>Term<dd>Definition</dl>"

      assert_compiled_snapshot(template, strict: false, auto_close_omitted_tags: true, escape: false)
    end

    test "dt and dd elements without closing tags - auto_close enabled - render" do
      template = "<dl><dt>Term<dd>Definition</dl>"

      assert_evaluated_snapshot(template, {}, { strict: false, auto_close_omitted_tags: true, escape: false })
    end

    test "option elements without closing tags - auto_close enabled - compilation" do
      template = '<select><option value="1">One<option value="2">Two</select>'

      assert_compiled_snapshot(template, strict: false, auto_close_omitted_tags: true, escape: false)
    end

    test "option elements without closing tags - auto_close enabled - render" do
      template = '<select><option value="1">One<option value="2">Two</select>'

      assert_evaluated_snapshot(template, {}, { strict: false, auto_close_omitted_tags: true, escape: false })
    end

    test "tr and td elements without closing tags - auto_close enabled - compilation" do
      template = "<table><tr><td>A<td>B<tr><td>C<td>D</table>"

      assert_compiled_snapshot(template, strict: false, auto_close_omitted_tags: true, escape: false)
    end

    test "tr and td elements without closing tags - auto_close enabled - render" do
      template = "<table><tr><td>A<td>B<tr><td>C<td>D</table>"

      assert_evaluated_snapshot(template, {}, { strict: false, auto_close_omitted_tags: true, escape: false })
    end

    test "thead tbody tfoot without closing tags - auto_close enabled - compilation" do
      template = "<table><thead><tr><th>H<tbody><tr><td>B<tfoot><tr><td>F</table>"

      assert_compiled_snapshot(template, strict: false, auto_close_omitted_tags: true, escape: false)
    end

    test "thead tbody tfoot without closing tags - auto_close enabled - render" do
      template = "<table><thead><tr><th>H<tbody><tr><td>B<tfoot><tr><td>F</table>"

      assert_evaluated_snapshot(template, {}, { strict: false, auto_close_omitted_tags: true, escape: false })
    end

    test "rt and rp elements without closing tags - auto_close enabled - compilation" do
      template = "<ruby>Base<rp>(<rt>annotation<rp>)</ruby>"

      assert_compiled_snapshot(template, strict: false, auto_close_omitted_tags: true, escape: false)
    end

    test "rt and rp elements without closing tags - auto_close enabled - render" do
      template = "<ruby>Base<rp>(<rt>annotation<rp>)</ruby>"

      assert_evaluated_snapshot(template, {}, { strict: false, auto_close_omitted_tags: true, escape: false })
    end

    test "erb expression in p element - auto_close enabled - compilation" do
      template = "<p><%= message %>"

      assert_compiled_snapshot(template, strict: false, auto_close_omitted_tags: true, escape: false)
    end

    test "erb expression in p element - auto_close enabled - render" do
      template = "<p><%= message %>"

      assert_evaluated_snapshot(template, { message: "Hello" }, { strict: false, auto_close_omitted_tags: true, escape: false })
    end

    test "erb loop with li elements - auto_close enabled - compilation" do
      template = "<ul><% items.each do |item| %><li><%= item %><% end %></ul>"

      assert_compiled_snapshot(template, strict: false, auto_close_omitted_tags: true, escape: false)
    end

    test "erb loop with li elements - auto_close enabled - render" do
      template = "<ul><% items.each do |item| %><li><%= item %><% end %></ul>"

      assert_evaluated_snapshot(template, { items: ["A", "B", "C"] }, { strict: false, auto_close_omitted_tags: true, escape: false })
    end

    test "mixed explicit and omitted closing tags - auto_close enabled - compilation" do
      template = "<ul><li>One</li><li>Two<li>Three</li></ul>"

      assert_compiled_snapshot(template, strict: false, auto_close_omitted_tags: true, escape: false)
    end

    test "mixed explicit and omitted closing tags - auto_close enabled - render" do
      template = "<ul><li>One</li><li>Two<li>Three</li></ul>"

      assert_evaluated_snapshot(template, {}, { strict: false, auto_close_omitted_tags: true, escape: false })
    end

    test "complex navigation with optional closing tags - auto_close enabled - compilation" do
      template = <<~ERB
        <nav>
          <ul>
            <% items.each do |item| %>
              <li><a href="<%= item[:url] %>"><%= item[:name] %></a>
            <% end %>
          </ul>
        </nav>
      ERB

      assert_compiled_snapshot(template, strict: false, auto_close_omitted_tags: true, escape: false)
    end

    test "complex navigation with optional closing tags - auto_close enabled - render" do
      template = <<~ERB
        <nav>
          <ul>
            <% items.each do |item| %>
              <li><a href="<%= item[:url] %>"><%= item[:name] %></a>
            <% end %>
          </ul>
        </nav>
      ERB

      items = [
        { name: "Home", url: "/" },
        { name: "About", url: "/about" }
      ]

      assert_evaluated_snapshot(template, { items: items }, { strict: false, auto_close_omitted_tags: true, escape: false })
    end

    test "complex table with optional closing tags - auto_close enabled - compilation" do
      template = <<~ERB
        <table>
          <thead>
            <tr>
              <th>Name
              <th>Age
          <tbody>
            <% users.each do |user| %>
              <tr>
                <td><%= user[:name] %>
                <td><%= user[:age] %>
            <% end %>
        </table>
      ERB

      assert_compiled_snapshot(template, strict: false, auto_close_omitted_tags: true, escape: false)
    end

    test "complex table with optional closing tags - auto_close enabled - render" do
      template = <<~ERB
        <table>
          <thead>
            <tr>
              <th>Name
              <th>Age
          <tbody>
            <% users.each do |user| %>
              <tr>
                <td><%= user[:name] %>
                <td><%= user[:age] %>
            <% end %>
        </table>
      ERB

      users = [
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 }
      ]

      assert_evaluated_snapshot(template, { users: users }, { strict: false, auto_close_omitted_tags: true, escape: false })
    end

    test "GitHub issue #965 - inline-block li elements - closing tag position preserves no-whitespace behavior - compilation" do
      template = <<~ERB
        <ul>
          <li style="display: inline-block">Foo
          <li style="display: inline-block">Bar
        </ul>
      ERB

      assert_compiled_snapshot(template, strict: false, auto_close_omitted_tags: true, escape: false)
    end

    test "inline-block li elements - closing tag position preserves no-whitespace behavior - render" do
      template = <<~ERB
        <ul>
          <li style="display: inline-block">Foo
          <li style="display: inline-block">Bar
        </ul>
      ERB

      assert_evaluated_snapshot(template, {}, { strict: false, auto_close_omitted_tags: true, escape: false })
    end

    test "inline-block li elements - single line maintains no whitespace - compilation" do
      template = '<ul><li style="display: inline-block">Foo<li style="display: inline-block">Bar</ul>'

      assert_compiled_snapshot(template, strict: false, auto_close_omitted_tags: true, escape: false)
    end

    test "inline-block li elements - single line maintains no whitespace - render" do
      template = '<ul><li style="display: inline-block">Foo<li style="display: inline-block">Bar</ul>'

      assert_evaluated_snapshot(template, {}, { strict: false, auto_close_omitted_tags: true, escape: false })
    end

    test "inline-block with erb - closing tag inserted at correct position - compilation" do
      template = <<~ERB
        <ul>
          <% items.each do |item| %>
            <li style="display: inline-block"><%= item %>
          <% end %>
        </ul>
      ERB

      assert_compiled_snapshot(template, strict: false, auto_close_omitted_tags: true, escape: false)
    end

    test "inline-block with erb - closing tag inserted at correct position - render" do
      template = <<~ERB
        <ul>
          <% items.each do |item| %>
            <li style="display: inline-block"><%= item %>
          <% end %>
        </ul>
      ERB

      assert_evaluated_snapshot(template, { items: ["A", "B", "C"] }, { strict: false, auto_close_omitted_tags: true, escape: false })
    end

    test "closing tag inserted immediately after content - no trailing whitespace added - compilation" do
      template = "<p>Text"

      engine = Herb::Engine.new(template, escape: false, strict: false, auto_close_omitted_tags: true)
      result = eval(engine.src)

      assert_equal "<p>Text</p>", result
    end

    test "p elements on separate lines - whitespace preserved between elements - render" do
      template = "<p>First\n<p>Second"

      assert_evaluated_snapshot(template, {}, { strict: false, auto_close_omitted_tags: true, escape: false })
    end

    test "comparing explicit vs omitted closing tags - whitespace difference - render" do
      explicit_template = <<~ERB
        <ul>
          <li>Foo</li>
          <li>Bar</li>
        </ul>
      ERB

      omitted_template = <<~ERB
        <ul>
          <li>Foo
          <li>Bar
        </ul>
      ERB

      explicit_engine = Herb::Engine.new(explicit_template, escape: false, auto_close_omitted_tags: false)
      omitted_engine = Herb::Engine.new(omitted_template, escape: false, strict: false, auto_close_omitted_tags: true)

      explicit_result = eval(explicit_engine.src)
      omitted_result = eval(omitted_engine.src)

      assert_includes explicit_result, "</li>\n"
      assert_includes omitted_result, "</li>"
    end
  end
end
