# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class WhitespaceTest < Minitest::Spec
    include SnapshotUtils

    test "whitespace tracking disabled by default" do
      assert_parsed_snapshot(<<~HTML)
        <div     class="hello">content</div>
      HTML
    end

    test "whitespace tracking when enabled" do
      assert_parsed_snapshot(<<~HTML, track_whitespace: true)
        <div     class="hello">content</div>
      HTML
    end

    test "whitespace between attributes" do
      assert_parsed_snapshot(<<~HTML, track_whitespace: true)
        <div class="foo"     id="bar">content</div>
      HTML
    end

    test "whitespace between ERB tag" do
      assert_parsed_snapshot(<<~HTML, track_whitespace: true)
        <%= hello %>     <%= world %>
      HTML
    end

    test "whitespace between close tag opening and tag name" do
      assert_parsed_snapshot(<<~HTML, track_whitespace: true)
        <div></    div>
      HTML
    end

    test "whitespace in close tag" do
      assert_parsed_snapshot(<<~HTML, track_whitespace: true)
        <div></div   >
      HTML
    end

    test "newline in close tag" do
      assert_parsed_snapshot(<<~HTML, track_whitespace: true)
        <div>
        </div
        >
      HTML
    end

    test "whitespace after boolean attributes" do
      assert_parsed_snapshot(<<~HTML, track_whitespace: true)
        <input     required  />
      HTML
    end

    test "whitespace around equals sign in attributes" do
      assert_parsed_snapshot(<<~HTML, track_whitespace: true)
        <div class  =  ""></div>
      HTML
    end

    test "self-closing tag with whitespace before slash" do
      assert_parsed_snapshot(<<~HTML, track_whitespace: true)
        <img src="test.jpg"     />
      HTML
    end

    test "multiple attributes with whitespace around equals" do
      assert_parsed_snapshot(<<~HTML, track_whitespace: true)
        <div data-foo  =  "bar"     class  =  "baz">content</div>
      HTML
    end

    test "mixed whitespace types in attributes" do
      assert_parsed_snapshot(<<~HTML, track_whitespace: true)
        <div \t\n  class="test">content</div>
      HTML
    end

    test "ERB with internal whitespace" do
      assert_parsed_snapshot(<<~HTML, track_whitespace: true)
        <%     content     %>
      HTML
    end

    test "ERB within attribute values with whitespace" do
      assert_parsed_snapshot(<<~HTML, track_whitespace: true)
        <div class="<%= foo %>    bar">content</div>
      HTML
    end

    test "HTML comment with internal whitespace" do
      assert_parsed_snapshot(<<~HTML, track_whitespace: true)
        <!--     comment content     -->
      HTML
    end

    test "DOCTYPE with whitespace" do
      assert_parsed_snapshot(<<~HTML, track_whitespace: true)
        <!DOCTYPE     html>
      HTML
    end

    test "multiline attributes with whitespace" do
      assert_parsed_snapshot(<<~HTML, track_whitespace: true)
        <div
          class="test"
          id="foo"  >content</div>
      HTML
    end

    test "boolean attributes mixed with valued attributes" do
      assert_parsed_snapshot(<<~HTML, track_whitespace: true)
        <input     required     type="text"     disabled  />
      HTML
    end

    test "whitespace before and after tag closing bracket" do
      assert_parsed_snapshot(<<~HTML, track_whitespace: true)
        <div class="test"   >   content   </div>
      HTML
    end

    test "nested tags with preserved whitespace" do
      assert_parsed_snapshot(<<~HTML, track_whitespace: true)
        <div   class="outer"  >
          <span     id="inner"    >text</span>
        </div>
      HTML
    end

    test "multiple boolean attributes with whitespace" do
      assert_parsed_snapshot(<<~HTML, track_whitespace: true)
        <input     checked     required     disabled     />
      HTML
    end

    test "empty attributes with whitespace around equals" do
      assert_parsed_snapshot(<<~HTML, track_whitespace: true)
        <div data-empty  =  ""     title  =  "">content</div>
      HTML
    end

    test "tabs and spaces mixed in attribute whitespace" do
      assert_parsed_snapshot(<<~HTML, track_whitespace: true)
        <div \t class \t = \t "test" \t >content</div>
      HTML
    end
  end
end
