# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class TagsTest < Minitest::Spec
    test "empty file" do
      result = ERBX.lex("")

      expected = %w[
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "basic tag" do
      result = ERBX.lex("<html></html>")

      expected = %w[
        TOKEN_START_TAG_START
        TOKEN_TAG_NAME
        TOKEN_START_TAG_END
        TOKEN_END_TAG_START
        TOKEN_TAG_NAME
        TOKEN_END_TAG_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "basic void tag" do
      result = ERBX.lex("<img />")

      expected = %w[
        TOKEN_START_TAG_START
        TOKEN_TAG_NAME
        TOKEN_START_TAG_END_VOID
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "namespaced tag" do
      result = ERBX.lex("<ns:table></ns:table>")

      expected = %w[
        TOKEN_START_TAG_START
        TOKEN_TAG_NAME
        TOKEN_START_TAG_END
        TOKEN_END_TAG_START
        TOKEN_TAG_NAME
        TOKEN_END_TAG_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "text content" do
      result = ERBX.lex("<h1>Hello World</h1>")

      expected = %w[
        TOKEN_START_TAG_START
        TOKEN_TAG_NAME
        TOKEN_START_TAG_END
        TOKEN_TEXT_CONTENT
        TOKEN_END_TAG_START
        TOKEN_TAG_NAME
        TOKEN_END_TAG_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute value double quotes" do
      result = ERBX.lex("<img value=\"hello world\" />")

      expected = %w[
        TOKEN_START_TAG_START
        TOKEN_TAG_NAME
        TOKEN_ATTRIBUTE_NAME
        TOKEN_EQUALS
        TOKEN_DOUBLE_QUOTE
        TOKEN_ATTRIBUTE_VALUE
        TOKEN_DOUBLE_QUOTE
        TOKEN_START_TAG_END_VOID
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute value single quotes" do
      result = ERBX.lex("<img value='hello world' />")

      expected = %w[
        TOKEN_START_TAG_START
        TOKEN_TAG_NAME
        TOKEN_ATTRIBUTE_NAME
        TOKEN_EQUALS
        TOKEN_SINGLE_QUOTE
        TOKEN_ATTRIBUTE_VALUE
        TOKEN_SINGLE_QUOTE
        TOKEN_START_TAG_END_VOID
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute value empty double quotes" do
      result = ERBX.lex("<img value=\"\" />")

      expected = %w[
        TOKEN_START_TAG_START
        TOKEN_TAG_NAME
        TOKEN_ATTRIBUTE_NAME
        TOKEN_EQUALS
        TOKEN_DOUBLE_QUOTE
        TOKEN_ATTRIBUTE_VALUE
        TOKEN_DOUBLE_QUOTE
        TOKEN_START_TAG_END_VOID
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute value empty single quotes" do
      result = ERBX.lex("<img value='' />")

      expected = %w[
        TOKEN_START_TAG_START
        TOKEN_TAG_NAME
        TOKEN_ATTRIBUTE_NAME
        TOKEN_EQUALS
        TOKEN_SINGLE_QUOTE
        TOKEN_ATTRIBUTE_VALUE
        TOKEN_SINGLE_QUOTE
        TOKEN_START_TAG_END_VOID
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "boolean attribute" do
      result = ERBX.lex("<img required />")

      expected = %w[
        TOKEN_START_TAG_START
        TOKEN_TAG_NAME
        TOKEN_ATTRIBUTE_NAME
        TOKEN_START_TAG_END_VOID
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end
  end
end
