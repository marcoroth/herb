# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class NewlinesTest < Minitest::Spec
    include SnapshotUtils

    test "line feed" do
      assert_parsed_snapshot("\n")
    end

    test "carriage return" do
      assert_parsed_snapshot("\r")
    end

    test "carriage return and line feed" do
      assert_parsed_snapshot("\r\n")
    end

    test "two newlines" do
      assert_parsed_snapshot("\n\n")
    end

    test "newline after space" do
      assert_parsed_snapshot(" \n")
    end

    test "text content before and after" do
      assert_parsed_snapshot("Hello\n\nWorld")
    end

    test "newline between text content" do
      assert_lexed_snapshot(<<~HTML)
        Hello
        World
      HTML
    end

    test "newline between html elements" do
      assert_parsed_snapshot(<<~HTML)
        <h1>Title 1</h1>
        <h2>Title 2</h2>
      HTML
    end

    test "newlines between html elements" do
      assert_parsed_snapshot(<<~HTML)
        <h1>Title 1</h1>

        <h2>Title 2</h2>
      HTML
    end

    test "newline inside html elements" do
      assert_parsed_snapshot(<<~HTML)
        <h1>
          Title 1
        </h1>
      HTML
    end

    test "newlines inside open tags" do
      assert_parsed_snapshot(<<~HTML)
        <h1
          id="header"
          class="class1 class2"
        >
          Content
        </h1>
      HTML
    end
  end
end
