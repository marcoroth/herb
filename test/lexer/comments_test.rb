# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class CommentsTest < Minitest::Spec
    test "HTML comment with padding whitespace" do
      result = ERBX.lex(%(<!-- Hello World -->))

      expected = %w[
        TOKEN_HTML_COMMENT_START
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_HTML_COMMENT_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "HTML comment with no whitespace" do
      result = ERBX.lex(%(<!--Hello World-->))

      expected = %w[
        TOKEN_HTML_COMMENT_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_HTML_COMMENT_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "HTML comment followed by html tag" do
      result = ERBX.lex(%(<!--Hello World--><h1>Hello</h1>))

      expected = %w[
        TOKEN_HTML_COMMENT_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_HTML_COMMENT_END

        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_HTML_TAG_END
        TOKEN_IDENTIFIER
        TOKEN_HTML_TAG_START_CLOSE
        TOKEN_IDENTIFIER
        TOKEN_HTML_TAG_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "HTML comment followed by html tag with nested comment" do
      result = ERBX.lex(%(
        <!--Hello World-->
        <h1><!-- Hello World --></h1>
      ))

      expected = %w[
        TOKEN_NEWLINE
        TOKEN_WHITESPACE

        TOKEN_HTML_COMMENT_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_HTML_COMMENT_END

        TOKEN_NEWLINE

        TOKEN_WHITESPACE
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_HTML_TAG_END

        TOKEN_HTML_COMMENT_START
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_HTML_COMMENT_END

        TOKEN_HTML_TAG_START_CLOSE
        TOKEN_IDENTIFIER
        TOKEN_HTML_TAG_END
        TOKEN_NEWLINE
        TOKEN_WHITESPACE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
      assert_equal [8, 1, 8, 1, 1, 1, 6], result.array.items.select { |token| token.type == "TOKEN_WHITESPACE" }.map(&:value).map(&:length)
    end
  end
end
