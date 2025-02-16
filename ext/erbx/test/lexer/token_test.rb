# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class TokenTest < Minitest::Spec
    test "whitespace" do
      result = ERBX.lex(" ")

      expected = %w[
        TOKEN_WHITESPACE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "multiple whitespace" do
      result = ERBX.lex("    ")

      expected = %w[
        TOKEN_WHITESPACE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
      assert_equal ["    ", ""], result.array.items.map(&:value)
    end

    test "multiple whitespace with newliens " do
      result = ERBX.lex(" \n  \n   \n")

      expected = %w[
        TOKEN_WHITESPACE
        TOKEN_NEWLINE
        TOKEN_WHITESPACE
        TOKEN_NEWLINE
        TOKEN_WHITESPACE
        TOKEN_NEWLINE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "non-breaking space" do
      result = ERBX.lex(" ")

      expected = %w[
        TOKEN_TEXT_CONTENT
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "newline" do
      result = ERBX.lex("\n")

      expected = %w[
        TOKEN_NEWLINE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "!" do
      result = ERBX.lex("!")

      expected = %w[
        TOKEN_EXCLAMATION
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "slash" do
      result = ERBX.lex("/")

      expected = %w[
        TOKEN_SLASH
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "dash" do
      result = ERBX.lex("-")

      expected = %w[
        TOKEN_DASH
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "underscore" do
      result = ERBX.lex("_")

      expected = %w[
        TOKEN_UNDERSCORE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "percent" do
      result = ERBX.lex("%")

      expected = %w[
        TOKEN_PERCENT
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "colon" do
      result = ERBX.lex(":")

      expected = %w[
        TOKEN_COLON
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "colon" do
      result = ERBX.lex("=")

      expected = %w[
        TOKEN_EQUALS
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "double quote" do
      result = ERBX.lex(%("))

      expected = %w[
        TOKEN_QUOTE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "single quote" do
      result = ERBX.lex(%('))

      expected = %w[
        TOKEN_QUOTE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "less than signs" do
      result = ERBX.lex("<<<<")

      expected = %w[
        TOKEN_LT
        TOKEN_LT
        TOKEN_LT
        TOKEN_LT
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "greater than signs" do
      result = ERBX.lex(">>>>")

      expected = %w[
        TOKEN_HTML_TAG_END
        TOKEN_HTML_TAG_END
        TOKEN_HTML_TAG_END
        TOKEN_HTML_TAG_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "LT, GT and PERCENT signs" do
      result = ERBX.lex(%(< % % >))

      expected = %w[
        TOKEN_LT
        TOKEN_WHITESPACE
        TOKEN_PERCENT
        TOKEN_WHITESPACE
        TOKEN_PERCENT
        TOKEN_WHITESPACE
        TOKEN_HTML_TAG_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
      assert_equal ["<", " ", "%", " ", "%", " ", ">", ""], result.array.items.map(&:value)
    end
  end
end
