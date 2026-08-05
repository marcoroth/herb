# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class OptionalClosingTagsTest < Minitest::Spec
    include SnapshotUtils

    test "li elements with implicit closing - followed by another li" do
      assert_parsed_snapshot(<<~HTML)
        <ul>
          <li>List Item 1
          <li>List Item 2
        </ul>
      HTML
    end

    test "li elements with implicit closing - closed by parent" do
      assert_parsed_snapshot(<<~HTML)
        <ul>
          <li>List Item 1
        </ul>
      HTML
    end

    test "li elements with explicit closing tags" do
      assert_parsed_snapshot(<<~HTML)
        <ul>
          <li>List Item 1</li>
          <li>List Item 2</li>
        </ul>
      HTML
    end

    test "li elements mixed explicit and implicit closing" do
      assert_parsed_snapshot(<<~HTML)
        <ul>
          <li>Item 1</li>
          <li>Item 2
          <li>Item 3</li>
        </ul>
      HTML
    end

    test "nested ul with implicit li closing" do
      assert_parsed_snapshot(<<~HTML)
        <ul>
          <li>Item 1
            <ul>
              <li>Nested 1
              <li>Nested 2
            </ul>
          <li>Item 2
        </ul>
      HTML
    end

    test "ol with implicit li closing" do
      assert_parsed_snapshot(<<~HTML)
        <ol>
          <li>First
          <li>Second
          <li>Third
        </ol>
      HTML
    end

    test "dt elements with implicit closing - followed by another dt" do
      assert_parsed_snapshot(<<~HTML)
        <dl>
          <dt>Term 1
          <dt>Term 2
        </dl>
      HTML
    end

    test "dt element implicitly closed by dd" do
      assert_parsed_snapshot(<<~HTML)
        <dl>
          <dt>Term
          <dd>Definition
        </dl>
      HTML
    end

    test "dd elements with implicit closing - followed by another dd" do
      assert_parsed_snapshot(<<~HTML)
        <dl>
          <dd>Definition 1
          <dd>Definition 2
        </dl>
      HTML
    end

    test "dd element implicitly closed by dt" do
      assert_parsed_snapshot(<<~HTML)
        <dl>
          <dd>Definition
          <dt>Term
        </dl>
      HTML
    end

    test "complete definition list with implicit closing" do
      assert_parsed_snapshot(<<~HTML)
        <dl>
          <dt>Term 1
          <dd>Definition 1
          <dt>Term 2
          <dd>Definition 2
        </dl>
      HTML
    end

    test "p element implicitly closed by another p" do
      assert_parsed_snapshot(<<~HTML)
        <div>
          <p>Paragraph 1
          <p>Paragraph 2
        </div>
      HTML
    end

    test "p element implicitly closed by div" do
      assert_parsed_snapshot(<<~HTML)
        <div>
          <p>Paragraph
          <div>Block element</div>
        </div>
      HTML
    end

    test "p element implicitly closed by heading" do
      assert_parsed_snapshot(<<~HTML)
        <div>
          <p>Paragraph
          <h1>Heading</h1>
        </div>
      HTML
    end

    test "p element implicitly closed by ul" do
      assert_parsed_snapshot(<<~HTML)
        <div>
          <p>Paragraph
          <ul><li>List item</li></ul>
        </div>
      HTML
    end

    test "p element implicitly closed by parent" do
      assert_parsed_snapshot(<<~HTML)
        <div>
          <p>Paragraph
        </div>
      HTML
    end

    test "rt elements with implicit closing" do
      assert_parsed_snapshot(<<~HTML)
        <ruby>
          漢<rt>かん
          字<rt>じ
        </ruby>
      HTML
    end

    test "rt element implicitly closed by rp" do
      assert_parsed_snapshot(<<~HTML)
        <ruby>
          漢<rt>かん<rp>(</rp>
        </ruby>
      HTML
    end

    test "rp elements with implicit closing" do
      assert_parsed_snapshot(<<~HTML)
        <ruby>
          漢<rp>(<rp>(
        </ruby>
      HTML
    end

    test "rp element implicitly closed by rt" do
      assert_parsed_snapshot(<<~HTML)
        <ruby>
          漢<rp>(<rt>かん
        </ruby>
      HTML
    end

    test "option elements with implicit closing" do
      assert_parsed_snapshot(<<~HTML)
        <select>
          <option>Option 1
          <option>Option 2
          <option>Option 3
        </select>
      HTML
    end

    test "option element implicitly closed by optgroup" do
      assert_parsed_snapshot(<<~HTML)
        <select>
          <option>Option 1
          <optgroup label="Group">
            <option>Option 2</option>
          </optgroup>
        </select>
      HTML
    end

    test "optgroup elements with implicit closing" do
      assert_parsed_snapshot(<<~HTML)
        <select>
          <optgroup label="Group 1">
            <option>Option 1</option>
          <optgroup label="Group 2">
            <option>Option 2</option>
        </select>
      HTML
    end

    test "thead implicitly closed by tbody" do
      assert_parsed_snapshot(<<~HTML)
        <table>
          <thead>
            <tr><th>Header</th></tr>
          <tbody>
            <tr><td>Data</td></tr>
          </tbody>
        </table>
      HTML
    end

    test "thead implicitly closed by tfoot" do
      assert_parsed_snapshot(<<~HTML)
        <table>
          <thead>
            <tr><th>Header</th></tr>
          <tfoot>
            <tr><td>Footer</td></tr>
          </tfoot>
        </table>
      HTML
    end

    test "tbody elements with implicit closing" do
      assert_parsed_snapshot(<<~HTML)
        <table>
          <tbody>
            <tr><td>Body 1</td></tr>
          <tbody>
            <tr><td>Body 2</td></tr>
        </table>
      HTML
    end

    test "tbody implicitly closed by tfoot" do
      assert_parsed_snapshot(<<~HTML)
        <table>
          <tbody>
            <tr><td>Body</td></tr>
          <tfoot>
            <tr><td>Footer</td></tr>
        </table>
      HTML
    end

    test "tr elements with implicit closing" do
      assert_parsed_snapshot(<<~HTML)
        <table>
          <tr><td>Row 1</td>
          <tr><td>Row 2</td>
        </table>
      HTML
    end

    test "tr implicitly closed by parent tbody" do
      assert_parsed_snapshot(<<~HTML)
        <table>
          <tbody>
            <tr><td>Row 1</td>
          </tbody>
        </table>
      HTML
    end

    test "td elements with implicit closing" do
      assert_parsed_snapshot(<<~HTML)
        <table>
          <tr>
            <td>Cell 1
            <td>Cell 2
          </tr>
        </table>
      HTML
    end

    test "td implicitly closed by th" do
      assert_parsed_snapshot(<<~HTML)
        <table>
          <tr>
            <td>Data
            <th>Header
          </tr>
        </table>
      HTML
    end

    test "th elements with implicit closing" do
      assert_parsed_snapshot(<<~HTML)
        <table>
          <tr>
            <th>Header 1
            <th>Header 2
          </tr>
        </table>
      HTML
    end

    test "th implicitly closed by td" do
      assert_parsed_snapshot(<<~HTML)
        <table>
          <tr>
            <th>Header
            <td>Data
          </tr>
        </table>
      HTML
    end

    test "colgroup implicitly closed by thead" do
      assert_parsed_snapshot(<<~HTML)
        <table>
          <colgroup>
            <col>
          <thead>
            <tr><th>Header</th></tr>
          </thead>
        </table>
      HTML
    end

    test "colgroup implicitly closed by tbody" do
      assert_parsed_snapshot(<<~HTML)
        <table>
          <colgroup>
            <col>
          <tbody>
            <tr><td>Data</td></tr>
          </tbody>
        </table>
      HTML
    end

    test "colgroup implicitly closed by tr" do
      assert_parsed_snapshot(<<~HTML)
        <table>
          <colgroup>
            <col>
          <tr><td>Data</td></tr>
        </table>
      HTML
    end

    test "complete table with implicit closing tags" do
      assert_parsed_snapshot(<<~HTML)
        <table>
          <colgroup>
            <col>
            <col>
          <thead>
            <tr>
              <th>Header 1
              <th>Header 2
          <tbody>
            <tr>
              <td>Cell 1
              <td>Cell 2
            <tr>
              <td>Cell 3
              <td>Cell 4
          <tfoot>
            <tr>
              <td>Footer 1
              <td>Footer 2
        </table>
      HTML
    end
  end
end
