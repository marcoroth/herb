# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"

module Engine
  class OptionalClosingTagsTest < Minitest::Spec
    include SnapshotUtils

    # P element tests
    test "p element without closing tag - compilation" do
      template = "<p>Hello World"

      assert_compiled_snapshot(template, strict: false)
    end

    test "p element without closing tag - render" do
      template = "<p>Hello World"

      assert_evaluated_snapshot(template, {}, { escape: false, strict: false })
    end

    test "p element with erb without closing tag - compilation" do
      template = "<p><%= message %>"

      assert_compiled_snapshot(template, strict: false)
    end

    test "p element with erb without closing tag - render" do
      template = "<p><%= message %>"

      assert_evaluated_snapshot(template, { message: "Hello" }, { escape: false, strict: false })
    end

    test "multiple p elements without closing tags - compilation" do
      template = <<~ERB
        <p>First paragraph
        <p>Second paragraph
        <p>Third paragraph
      ERB

      assert_compiled_snapshot(template, strict: false)
    end

    test "multiple p elements without closing tags - render" do
      template = <<~ERB
        <p>First paragraph
        <p>Second paragraph
        <p>Third paragraph
      ERB

      assert_evaluated_snapshot(template, {}, { escape: false, strict: false })
    end

    # LI element tests
    test "li elements without closing tags - compilation" do
      template = <<~ERB
        <ul>
          <li>Item 1
          <li>Item 2
          <li>Item 3
        </ul>
      ERB

      assert_compiled_snapshot(template, strict: false)
    end

    test "li elements without closing tags - render" do
      template = <<~ERB
        <ul>
          <li>Item 1
          <li>Item 2
          <li>Item 3
        </ul>
      ERB

      assert_evaluated_snapshot(template, {}, { escape: false, strict: false })
    end

    test "li elements with erb without closing tags - compilation" do
      template = <<~ERB
        <ul>
          <% items.each do |item| %>
            <li><%= item %>
          <% end %>
        </ul>
      ERB

      assert_compiled_snapshot(template, strict: false)
    end

    test "li elements with erb without closing tags - render" do
      template = <<~ERB
        <ul>
          <% items.each do |item| %>
            <li><%= item %>
          <% end %>
        </ul>
      ERB

      assert_evaluated_snapshot(template, { items: ["Apple", "Banana", "Cherry"] }, { escape: false, strict: false })
    end

    # DT/DD element tests
    test "dt and dd elements without closing tags - compilation" do
      template = <<~ERB
        <dl>
          <dt>Term 1
          <dd>Definition 1
          <dt>Term 2
          <dd>Definition 2
        </dl>
      ERB

      assert_compiled_snapshot(template, strict: false)
    end

    test "dt and dd elements without closing tags - render" do
      template = <<~ERB
        <dl>
          <dt>Term 1
          <dd>Definition 1
          <dt>Term 2
          <dd>Definition 2
        </dl>
      ERB

      assert_evaluated_snapshot(template, {}, { escape: false, strict: false })
    end

    # Option element tests
    test "option elements without closing tags - compilation" do
      template = <<~ERB
        <select>
          <option value="1">One
          <option value="2">Two
          <option value="3">Three
        </select>
      ERB

      assert_compiled_snapshot(template, strict: false)
    end

    test "option elements without closing tags - render" do
      template = <<~ERB
        <select>
          <option value="1">One
          <option value="2">Two
          <option value="3">Three
        </select>
      ERB

      assert_evaluated_snapshot(template, {}, { escape: false, strict: false })
    end

    test "option elements with erb without closing tags - compilation" do
      template = <<~ERB
        <select>
          <% select_options.each do |opt| %>
            <option value="<%= opt[:value] %>"><%= opt[:label] %>
          <% end %>
        </select>
      ERB

      assert_compiled_snapshot(template, strict: false)
    end

    test "option elements with erb without closing tags - render" do
      template = <<~ERB
        <select>
          <% select_options.each do |opt| %>
            <option value="<%= opt[:value] %>"><%= opt[:label] %>
          <% end %>
        </select>
      ERB

      select_options = [
        { value: "1", label: "One" },
        { value: "2", label: "Two" },
        { value: "3", label: "Three" }
      ]

      assert_evaluated_snapshot(template, { select_options: select_options }, { escape: false, strict: false })
    end

    # Optgroup element tests
    test "optgroup elements without closing tags - compilation" do
      template = <<~ERB
        <select>
          <optgroup label="Group 1">
            <option>A
            <option>B
          <optgroup label="Group 2">
            <option>C
            <option>D
        </select>
      ERB

      assert_compiled_snapshot(template, strict: false)
    end

    test "optgroup elements without closing tags - render" do
      template = <<~ERB
        <select>
          <optgroup label="Group 1">
            <option>A
            <option>B
          <optgroup label="Group 2">
            <option>C
            <option>D
        </select>
      ERB

      assert_evaluated_snapshot(template, {}, { escape: false, strict: false })
    end

    # Table element tests
    test "tr elements without closing tags - compilation" do
      template = <<~ERB
        <table>
          <tr>
            <td>Cell 1
            <td>Cell 2
          <tr>
            <td>Cell 3
            <td>Cell 4
        </table>
      ERB

      assert_compiled_snapshot(template, strict: false)
    end

    test "tr elements without closing tags - render" do
      template = <<~ERB
        <table>
          <tr>
            <td>Cell 1
            <td>Cell 2
          <tr>
            <td>Cell 3
            <td>Cell 4
        </table>
      ERB

      assert_evaluated_snapshot(template, {}, { escape: false, strict: false })
    end

    test "td and th elements without closing tags - compilation" do
      template = <<~ERB
        <table>
          <tr>
            <th>Header 1
            <th>Header 2
          <tr>
            <td>Data 1
            <td>Data 2
        </table>
      ERB

      assert_compiled_snapshot(template, strict: false)
    end

    test "td and th elements without closing tags - render" do
      template = <<~ERB
        <table>
          <tr>
            <th>Header 1
            <th>Header 2
          <tr>
            <td>Data 1
            <td>Data 2
        </table>
      ERB

      assert_evaluated_snapshot(template, {}, { escape: false, strict: false })
    end

    test "thead tbody tfoot without closing tags - compilation" do
      template = <<~ERB
        <table>
          <thead>
            <tr><th>Header
          <tbody>
            <tr><td>Body
          <tfoot>
            <tr><td>Footer
        </table>
      ERB

      assert_compiled_snapshot(template, strict: false)
    end

    test "thead tbody tfoot without closing tags - render" do
      template = <<~ERB
        <table>
          <thead>
            <tr><th>Header
          <tbody>
            <tr><td>Body
          <tfoot>
            <tr><td>Footer
        </table>
      ERB

      assert_evaluated_snapshot(template, {}, { escape: false, strict: false })
    end

    # Colgroup element tests
    test "colgroup element without closing tag - compilation" do
      template = <<~ERB
        <table>
          <colgroup>
            <col style="width: 50%">
            <col style="width: 50%">
          <tr>
            <td>A
            <td>B
        </table>
      ERB

      assert_compiled_snapshot(template, strict: false)
    end

    test "colgroup element without closing tag - render" do
      template = <<~ERB
        <table>
          <colgroup>
            <col style="width: 50%">
            <col style="width: 50%">
          <tr>
            <td>A
            <td>B
        </table>
      ERB

      assert_evaluated_snapshot(template, {}, { escape: false, strict: false })
    end

    # RT/RP element tests
    test "rt and rp elements without closing tags - compilation" do
      template = <<~ERB
        <ruby>
          Base
          <rp>(
          <rt>annotation
          <rp>)
        </ruby>
      ERB

      assert_compiled_snapshot(template, strict: false)
    end

    test "rt and rp elements without closing tags - render" do
      template = <<~ERB
        <ruby>
          Base
          <rp>(
          <rt>annotation
          <rp>)
        </ruby>
      ERB

      assert_evaluated_snapshot(template, {}, { escape: false, strict: false })
    end

    # Complex mixed tests
    test "complex form with optional closing tags - compilation" do
      template = <<~ERB
        <form>
          <p>Please fill out the form
          <p>
            <label>Name:</label>
            <input type="text" name="name">
          <p>
            <label>Country:</label>
            <select name="country">
              <option value="">Select...
              <option value="us">United States
              <option value="uk">United Kingdom
              <option value="ca">Canada
            </select>
          <p>
            <button type="submit">Submit</button>
        </form>
      ERB

      assert_compiled_snapshot(template, strict: false)
    end

    test "complex form with optional closing tags - render" do
      template = <<~ERB
        <form>
          <p>Please fill out the form
          <p>
            <label>Name:</label>
            <input type="text" name="name">
          <p>
            <label>Country:</label>
            <select name="country">
              <option value="">Select...
              <option value="us">United States
              <option value="uk">United Kingdom
              <option value="ca">Canada
            </select>
          <p>
            <button type="submit">Submit</button>
        </form>
      ERB

      assert_evaluated_snapshot(template, {}, { escape: false, strict: false })
    end

    test "erb loop with li elements without closing tags - compilation" do
      template = <<~ERB
        <nav>
          <ul>
            <% items.each do |item| %>
              <li>
                <a href="<%= item[:url] %>"><%= item[:name] %></a>
            <% end %>
          </ul>
        </nav>
      ERB

      assert_compiled_snapshot(template, strict: false)
    end

    test "erb loop with li elements without closing tags - render" do
      template = <<~ERB
        <nav>
          <ul>
            <% items.each do |item| %>
              <li>
                <a href="<%= item[:url] %>"><%= item[:name] %></a>
            <% end %>
          </ul>
        </nav>
      ERB

      items = [
        { name: "Home", url: "/" },
        { name: "About", url: "/about" },
        { name: "Contact", url: "/contact" }
      ]

      assert_evaluated_snapshot(template, { items: items }, { escape: false, strict: false })
    end

    test "table with erb and optional closing tags - compilation" do
      template = <<~ERB
        <table>
          <thead>
            <tr>
              <th>Name
              <th>Age
              <th>City
          <tbody>
            <% users.each do |user| %>
              <tr>
                <td><%= user[:name] %>
                <td><%= user[:age] %>
                <td><%= user[:city] %>
            <% end %>
        </table>
      ERB

      assert_compiled_snapshot(template, strict: false)
    end

    test "table with erb and optional closing tags - render" do
      template = <<~ERB
        <table>
          <thead>
            <tr>
              <th>Name
              <th>Age
              <th>City
          <tbody>
            <% users.each do |user| %>
              <tr>
                <td><%= user[:name] %>
                <td><%= user[:age] %>
                <td><%= user[:city] %>
            <% end %>
        </table>
      ERB

      users = [
        { name: "Alice", age: 30, city: "New York" },
        { name: "Bob", age: 25, city: "London" },
        { name: "Charlie", age: 35, city: "Paris" }
      ]

      assert_evaluated_snapshot(template, { users: users }, { escape: false, strict: false })
    end
  end
end
