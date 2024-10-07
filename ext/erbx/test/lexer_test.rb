# frozen_string_literal: true

require_relative "test_helper"

class LexerTest < Minitest::Test
  def test_lexer
    result = ERBX.lex("<html></html>")

    expected = [
      "TOKEN_START_TAG_START",
      "TOKEN_TAG_NAME",
      "TOKEN_START_TAG_END",
      "TOKEN_END_TAG_START",
      "TOKEN_TAG_NAME",
      "TOKEN_END_TAG_END",
      "TOKEN_EOF"
    ]

    assert_equal expected, result.array.items.map(&:type)
  end
end
