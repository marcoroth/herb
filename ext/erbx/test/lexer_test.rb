# frozen_string_literal: true

require_relative "test_helper"

class LexerTest < Minitest::Test
  def test_lexer
    assert_equal "test", ERBX.lex("<html></html>")
  end
end
