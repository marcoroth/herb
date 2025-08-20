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

    test "invalid HTML" do
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
  end
end
