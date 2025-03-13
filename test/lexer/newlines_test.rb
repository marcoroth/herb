# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class NewlinesTest < Minitest::Spec
    include SnapshotUtils

    test "line feed" do
      assert_lexed_snapshot("\n")
    end

    test "carriage return" do
      assert_lexed_snapshot("\r")
    end

    test "carriage return and line feed" do
      assert_lexed_snapshot("\r\n")
    end

    test "two newlines" do
      assert_lexed_snapshot("\n\n")
    end

    test "newline after space" do
      assert_lexed_snapshot(" \n")
    end

    test "text content before and after" do
      assert_lexed_snapshot("Hello\n\nWorld")
    end

    test "newline between text content" do
      assert_lexed_snapshot(<<~HTML)
        Hello
        World
      HTML
    end

    test "newline between html elements" do
      assert_lexed_snapshot(<<~HTML)
        <h1>Title 1</h1>
        <h2>Title 2</h2>
      HTML
    end

    test "newlines between html elements" do
      assert_lexed_snapshot(<<~HTML)
        <h1>Title 1</h1>

        <h2>Title 2</h2>
      HTML
    end

    test "newline inside html elements" do
      assert_lexed_snapshot(<<~HTML)
        <h1>
          Title 1
        </h1>
      HTML
    end
  end
end
