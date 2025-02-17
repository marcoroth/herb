# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class BooleanAttributesTest < Minitest::Spec
    test "boolean attribute" do
      result = ERBX.lex("<img required />")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "boolean attribute without whitespace and with self-closing tag" do
      result = ERBX.lex("<img required/>")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "boolean attribute without whitespace and without self-closing tag" do
      result = ERBX.lex("<img required>")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_HTML_TAG_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "boolean attribute without whitespace" do
      result = ERBX.lex("<img required/>")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end
  end
end
