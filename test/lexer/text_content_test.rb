# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class TextContentTest < Minitest::Spec
    test "text content" do
      result = ERBX.lex("<h1>Some Text</h1>")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_HTML_TAG_END
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_HTML_TAG_START_CLOSE
        TOKEN_IDENTIFIER
        TOKEN_HTML_TAG_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "text content with period" do
      result = ERBX.lex("<h1>Some. Text.</h1>")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_HTML_TAG_END
        TOKEN_IDENTIFIER
        TOKEN_CHARACTER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_CHARACTER
        TOKEN_HTML_TAG_START_CLOSE
        TOKEN_IDENTIFIER
        TOKEN_HTML_TAG_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end
  end
end
