# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class LexerTest < Minitest::Spec
    test "nil" do
      result = ERBX.lex(nil)

      expected = %w[
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "empty file" do
      result = ERBX.lex("")

      expected = %w[
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end
  end
end
