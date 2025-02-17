# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class AttributesTest < Minitest::Spec
    test "attribute value double quotes" do
      result = ERBX.lex(%(<img value="hello world" />))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_EQUALS
        TOKEN_QUOTE
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_QUOTE
        TOKEN_WHITESPACE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute value single quotes" do
      result = ERBX.lex(%(<img value='hello world' />))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_EQUALS
        TOKEN_QUOTE
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_QUOTE
        TOKEN_WHITESPACE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute value empty double quotes with whitespace" do
      result = ERBX.lex(%(<img value="" />))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_EQUALS
        TOKEN_QUOTE
        TOKEN_QUOTE
        TOKEN_WHITESPACE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute value empty double quotes without whitespace" do
      result = ERBX.lex(%(<img value=""/>))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_EQUALS
        TOKEN_QUOTE
        TOKEN_QUOTE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute value empty single quotes with whitespace" do
      result = ERBX.lex("<img value='' />")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_EQUALS
        TOKEN_QUOTE
        TOKEN_QUOTE
        TOKEN_WHITESPACE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute value empty single quotes without whitespace" do
      result = ERBX.lex("<img value=''/>")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_EQUALS
        TOKEN_QUOTE
        TOKEN_QUOTE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute value single quotes with />" do
      result = ERBX.lex("<img value='/>'/>")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_EQUALS
        TOKEN_QUOTE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_QUOTE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute value double quotes with />" do
      result = ERBX.lex(%(<img value="/>"/>))

      # `>` is not valid as an attribute value, it should be &lt; which is why we parse it as TOKEN_HTML_TAG_END
      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_EQUALS
        TOKEN_QUOTE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_QUOTE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute value single quotes with > value" do
      result = ERBX.lex(%(<img value='>'/>))

      # `>` is not valid as an attribute value, it should be &lt; which is why we parse it as TOKEN_HTML_TAG_END
      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_EQUALS
        TOKEN_QUOTE
        TOKEN_HTML_TAG_END
        TOKEN_QUOTE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute value double quotes with /" do
      result = ERBX.lex(%(<img value="/"/>))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_EQUALS
        TOKEN_QUOTE
        TOKEN_SLASH
        TOKEN_QUOTE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute value double quotes with > value" do
      result = ERBX.lex(%(<img value=">"/>))

      # `>` is not valid as an attribute value, it should be &lt; which is why we parse it as TOKEN_HTML_TAG_END
      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_EQUALS
        TOKEN_QUOTE
        TOKEN_HTML_TAG_END
        TOKEN_QUOTE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute value single quotes with / value" do
      result = ERBX.lex(%(<img value='>'/>))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_EQUALS
        TOKEN_QUOTE
        TOKEN_HTML_TAG_END
        TOKEN_QUOTE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute value double quotes with / value" do
      result = ERBX.lex(%(<img value=">"/>))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_EQUALS
        TOKEN_QUOTE
        TOKEN_HTML_TAG_END
        TOKEN_QUOTE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute value double quotes with single quote value" do
      result = ERBX.lex(%(<img value="''"/>))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_EQUALS
        TOKEN_QUOTE
        TOKEN_QUOTE
        TOKEN_QUOTE
        TOKEN_QUOTE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute value single quotes with double quote value" do
      result = ERBX.lex(%(<img value='""'/>))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_EQUALS
        TOKEN_QUOTE
        TOKEN_QUOTE
        TOKEN_QUOTE
        TOKEN_QUOTE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute value empty quotes followed by another attribute" do
      result = ERBX.lex(%(<img value="" required />))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_EQUALS
        TOKEN_QUOTE
        TOKEN_QUOTE
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end
  end
end
