# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"
require_relative "../../lib/herb/engine/auto_close_omitted_tags_visitor"

module Engine
  class AutoCloseOmittedTagsVisitorTest < Minitest::Spec
    include SnapshotUtils

    def auto_close_options
      {
        escape: false,
        parser_options: { strict: false },
        visitors: [Herb::Engine::AutoCloseOmittedTagsVisitor.new],
      }
    end

    test "visitor is not loaded when only requiring herb" do
      load_path = $LOAD_PATH.map { |path| "-I#{path}" }.join(" ")
      output = `#{Gem.ruby} #{load_path} -e 'require "herb"; print defined?(Herb::Engine::AutoCloseOmittedTagsVisitor).inspect' 2>&1`

      assert_equal "nil", output
    end

    test "p element without closing tag - compilation" do
      template = "<p>Hello World"

      assert_compiled_snapshot(template, auto_close_options)
    end

    test "p element without closing tag - render" do
      template = "<p>Hello World"

      assert_evaluated_snapshot(template, {}, auto_close_options)
    end

    test "multiple p elements without closing tags - compilation" do
      template = "<p>First<p>Second<p>Third"

      assert_compiled_snapshot(template, auto_close_options)
    end

    test "multiple p elements without closing tags - render" do
      template = "<p>First<p>Second<p>Third"

      assert_evaluated_snapshot(template, {}, auto_close_options)
    end

    test "li elements without closing tags - compilation" do
      template = "<ul><li>One<li>Two</ul>"

      assert_compiled_snapshot(template, auto_close_options)
    end

    test "li elements without closing tags - render" do
      template = "<ul><li>One<li>Two</ul>"

      assert_evaluated_snapshot(template, {}, auto_close_options)
    end

    test "dt and dd elements without closing tags - compilation" do
      template = "<dl><dt>Term<dd>Definition</dl>"

      assert_compiled_snapshot(template, auto_close_options)
    end

    test "dt and dd elements without closing tags - render" do
      template = "<dl><dt>Term<dd>Definition</dl>"

      assert_evaluated_snapshot(template, {}, auto_close_options)
    end

    test "option elements without closing tags - compilation" do
      template = '<select><option value="1">One<option value="2">Two</select>'

      assert_compiled_snapshot(template, auto_close_options)
    end

    test "option elements without closing tags - render" do
      template = '<select><option value="1">One<option value="2">Two</select>'

      assert_evaluated_snapshot(template, {}, auto_close_options)
    end

    test "tr and td elements without closing tags - compilation" do
      template = "<table><tr><td>A<td>B<tr><td>C<td>D</table>"

      assert_compiled_snapshot(template, auto_close_options)
    end

    test "tr and td elements without closing tags - render" do
      template = "<table><tr><td>A<td>B<tr><td>C<td>D</table>"

      assert_evaluated_snapshot(template, {}, auto_close_options)
    end

    test "thead tbody tfoot without closing tags - compilation" do
      template = "<table><thead><tr><th>H<tbody><tr><td>B<tfoot><tr><td>F</table>"

      assert_compiled_snapshot(template, auto_close_options)
    end

    test "thead tbody tfoot without closing tags - render" do
      template = "<table><thead><tr><th>H<tbody><tr><td>B<tfoot><tr><td>F</table>"

      assert_evaluated_snapshot(template, {}, auto_close_options)
    end

    test "rt and rp elements without closing tags - compilation" do
      template = "<ruby>Base<rp>(<rt>annotation<rp>)</ruby>"

      assert_compiled_snapshot(template, auto_close_options)
    end

    test "rt and rp elements without closing tags - render" do
      template = "<ruby>Base<rp>(<rt>annotation<rp>)</ruby>"

      assert_evaluated_snapshot(template, {}, auto_close_options)
    end

    test "erb expression in p element - compilation" do
      template = "<p><%= message %>"

      assert_compiled_snapshot(template, auto_close_options)
    end

    test "erb expression in p element - render" do
      template = "<p><%= message %>"

      assert_evaluated_snapshot(template, { message: "Hello" }, auto_close_options)
    end

    test "erb loop with li elements - compilation" do
      template = "<ul><% items.each do |item| %><li><%= item %><% end %></ul>"

      assert_compiled_snapshot(template, auto_close_options)
    end

    test "erb loop with li elements - render" do
      template = "<ul><% items.each do |item| %><li><%= item %><% end %></ul>"

      assert_evaluated_snapshot(template, { items: ["A", "B", "C"] }, auto_close_options)
    end

    test "mixed explicit and omitted closing tags - compilation" do
      template = "<ul><li>One</li><li>Two<li>Three</li></ul>"

      assert_compiled_snapshot(template, auto_close_options)
    end

    test "mixed explicit and omitted closing tags - render" do
      template = "<ul><li>One</li><li>Two<li>Three</li></ul>"

      assert_evaluated_snapshot(template, {}, auto_close_options)
    end

    test "complex navigation with optional closing tags - compilation" do
      template = <<~ERB
        <nav>
          <ul>
            <% items.each do |item| %>
              <li><a href="<%= item[:url] %>"><%= item[:name] %></a>
            <% end %>
          </ul>
        </nav>
      ERB

      assert_compiled_snapshot(template, auto_close_options)
    end

    test "complex navigation with optional closing tags - render" do
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

      assert_evaluated_snapshot(template, { items: items }, auto_close_options)
    end

    test "complex table with optional closing tags - compilation" do
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

      assert_compiled_snapshot(template, auto_close_options)
    end

    test "complex table with optional closing tags - render" do
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

      assert_evaluated_snapshot(template, { users: users }, auto_close_options)
    end

    test "GitHub issue #965 - inline-block li elements - closing tag position preserves no-whitespace behavior - compilation" do
      template = <<~ERB
        <ul>
          <li style="display: inline-block">Foo
          <li style="display: inline-block">Bar
        </ul>
      ERB

      assert_compiled_snapshot(template, auto_close_options)
    end

    test "inline-block li elements - closing tag position preserves no-whitespace behavior - render" do
      template = <<~ERB
        <ul>
          <li style="display: inline-block">Foo
          <li style="display: inline-block">Bar
        </ul>
      ERB

      assert_evaluated_snapshot(template, {}, auto_close_options)
    end

    test "inline-block li elements - single line maintains no whitespace - compilation" do
      template = '<ul><li style="display: inline-block">Foo<li style="display: inline-block">Bar</ul>'

      assert_compiled_snapshot(template, auto_close_options)
    end

    test "inline-block li elements - single line maintains no whitespace - render" do
      template = '<ul><li style="display: inline-block">Foo<li style="display: inline-block">Bar</ul>'

      assert_evaluated_snapshot(template, {}, auto_close_options)
    end

    test "inline-block with erb - closing tag inserted at correct position - compilation" do
      template = <<~ERB
        <ul>
          <% items.each do |item| %>
            <li style="display: inline-block"><%= item %>
          <% end %>
        </ul>
      ERB

      assert_compiled_snapshot(template, auto_close_options)
    end

    test "inline-block with erb - closing tag inserted at correct position - render" do
      template = <<~ERB
        <ul>
          <% items.each do |item| %>
            <li style="display: inline-block"><%= item %>
          <% end %>
        </ul>
      ERB

      assert_evaluated_snapshot(template, { items: ["A", "B", "C"] }, auto_close_options)
    end

    test "p elements on separate lines - whitespace preserved between elements - render" do
      template = "<p>First\n<p>Second"

      assert_evaluated_snapshot(template, {}, auto_close_options)
    end

    test "closing tag inserted immediately after content - no trailing whitespace added" do
      engine = Herb::Engine.new("<p>Text", auto_close_options)

      assert_equal "<p>Text</p>", eval(engine.src)
    end

    test "without the visitor the omitted closing tag is not emitted" do
      template = "<ul><li>One<li>Two</ul>"

      engine = Herb::Engine.new(template, escape: false, parser_options: { strict: false })

      assert_equal "<ul><li>One<li>Two</ul>", eval(engine.src)
    end

    test "explicit closing tags are left untouched" do
      template = "<ul><li>One</li><li>Two</li></ul>"

      engine = Herb::Engine.new(template, auto_close_options)

      assert_equal template, eval(engine.src)
    end

    test "void elements are not given a closing tag" do
      template = "<div><br><img src=\"a.png\"></div>"

      engine = Herb::Engine.new(template, auto_close_options)

      assert_equal template, eval(engine.src)
    end

    test "the visitor replaces the omitted close tag node in the AST" do
      result = Herb.parse("<ul><li>One<li>Two</ul>", strict: false)

      result.value.accept(Herb::Engine::AutoCloseOmittedTagsVisitor.new)

      close_tags = []

      collect = lambda do |node|
        close_tags << node.close_tag if node.is_a?(Herb::AST::HTMLElementNode)
        node.compact_child_nodes.each { |child| collect.call(child) }
      end

      collect.call(result.value)

      assert_empty close_tags.compact.grep(Herb::AST::HTMLOmittedCloseTagNode)
      assert_equal(2, close_tags.compact.grep(Herb::AST::HTMLCloseTagNode).count { |node| node.tag_name.value == "li" })
    end
  end
end
