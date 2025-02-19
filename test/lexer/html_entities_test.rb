# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class HTMLEntitiesTest < Minitest::Spec
    test "&lt;" do
      result = ERBX.lex("&lt;")

      expected = %w[
        TOKEN_AMPERSAND
        TOKEN_IDENTIFIER
        TOKEN_SEMICOLON
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "&gt;" do
      result = ERBX.lex("&gt;")

      expected = %w[
        TOKEN_AMPERSAND
        TOKEN_IDENTIFIER
        TOKEN_SEMICOLON
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "&nbsp;" do
      result = ERBX.lex("&nbsp;")

      expected = %w[
        TOKEN_AMPERSAND
        TOKEN_IDENTIFIER
        TOKEN_SEMICOLON
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "&quot;" do
      result = ERBX.lex("&quot;")

      expected = %w[
        TOKEN_AMPERSAND
        TOKEN_IDENTIFIER
        TOKEN_SEMICOLON
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "&apos;" do
      result = ERBX.lex("&apos;")

      expected = %w[
        TOKEN_AMPERSAND
        TOKEN_IDENTIFIER
        TOKEN_SEMICOLON
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "ampersand" do
      result = ERBX.lex("&amp;")

      expected = %w[
        TOKEN_AMPERSAND
        TOKEN_IDENTIFIER
        TOKEN_SEMICOLON
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "literal ampersand" do
      result = ERBX.lex("&")

      expected = %w[
        TOKEN_AMPERSAND
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end
  end
end
