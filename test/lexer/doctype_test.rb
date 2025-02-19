# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class DoctypeTest < Minitest::Spec
    test "doctype" do
      result = ERBX.lex("<!DOCTYPE>")

      expected = %w[
        TOKEN_HTML_DOCTYPE
        TOKEN_HTML_TAG_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "doctype with space" do
      result = ERBX.lex("<!DOCTYPE >")

      expected = %w[
        TOKEN_HTML_DOCTYPE
        TOKEN_WHITESPACE
        TOKEN_HTML_TAG_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "doctype with html" do
      result = ERBX.lex("<!DOCTYPE html>")

      expected = %w[
        TOKEN_HTML_DOCTYPE
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_HTML_TAG_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "html4 doctype" do
      result = ERBX.lex(%(<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">))

      expected = %w[
        TOKEN_HTML_DOCTYPE
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE

        TOKEN_QUOTE
        TOKEN_DASH
        TOKEN_SLASH
        TOKEN_SLASH
        TOKEN_IDENTIFIER
        TOKEN_SLASH
        TOKEN_SLASH
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_CHARACTER
        TOKEN_IDENTIFIER
        TOKEN_SLASH
        TOKEN_SLASH
        TOKEN_IDENTIFIER
        TOKEN_QUOTE

        TOKEN_WHITESPACE

        TOKEN_QUOTE
        TOKEN_IDENTIFIER
        TOKEN_SLASH
        TOKEN_SLASH
        TOKEN_IDENTIFIER
        TOKEN_CHARACTER
        TOKEN_IDENTIFIER
        TOKEN_CHARACTER
        TOKEN_IDENTIFIER
        TOKEN_SLASH
        TOKEN_IDENTIFIER
        TOKEN_SLASH
        TOKEN_IDENTIFIER
        TOKEN_SLASH
        TOKEN_IDENTIFIER
        TOKEN_CHARACTER
        TOKEN_IDENTIFIER
        TOKEN_QUOTE

        TOKEN_HTML_TAG_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "doctype case insensitivity" do
      doctypes = ["<!DOCTYPE>", "<!doctype>", "<!DoCtYpE>", "<!dOcTyPe>"]

      expected = %w[
        TOKEN_HTML_DOCTYPE
        TOKEN_HTML_TAG_END
        TOKEN_EOF
      ]

      doctypes.each do |doctype|
        assert_equal expected, ERBX.lex(doctype).array.items.map(&:type), "#{doctype} didn't match"
      end
    end
  end
end
