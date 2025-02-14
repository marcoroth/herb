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

    xtest "whitespace" do
      result = ERBX.lex(" ")

      expected = %w[
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "basic tag" do
      result = ERBX.lex("<html></html>")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_HTML_TAG_END
        TOKEN_HTML_CLOSE_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_HTML_TAG_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "basic void tag" do
      result = ERBX.lex("<img />")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "basic void tag without whitespace" do
      result = ERBX.lex("<img/>")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "namespaced tag" do
      result = ERBX.lex("<ns:table></ns:table>")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_HTML_TAG_END
        TOKEN_HTML_CLOSE_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_HTML_TAG_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "text content" do
      result = ERBX.lex("<h1>Hello World</h1>")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_HTML_TAG_END
        TOKEN_TEXT_CONTENT
        TOKEN_HTML_CLOSE_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_HTML_TAG_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute value double quotes" do
      result = ERBX.lex(%(<img value="hello world" />))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_EQUALS
        TOKEN_HTML_QUOTE
        TOKEN_HTML_ATTRIBUTE_VALUE
        TOKEN_HTML_QUOTE
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
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_EQUALS
        TOKEN_HTML_QUOTE
        TOKEN_HTML_ATTRIBUTE_VALUE
        TOKEN_HTML_QUOTE
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
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_EQUALS
        TOKEN_HTML_QUOTE
        TOKEN_HTML_QUOTE
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
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_EQUALS
        TOKEN_HTML_QUOTE
        TOKEN_HTML_QUOTE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute value empty single quotes with whitespace" do
      result = ERBX.lex("<img value='' />")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_EQUALS
        TOKEN_HTML_QUOTE
        TOKEN_HTML_QUOTE
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
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_EQUALS
        TOKEN_HTML_QUOTE
        TOKEN_HTML_QUOTE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    xtest "attribute value single quotes with />" do
      result = ERBX.lex("<img value='/>'/>")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_EQUALS
        TOKEN_HTML_QUOTE
        TOKEN_HTML_ATTRIBUTE_VALUE
        TOKEN_HTML_QUOTE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    xtest "attribute value double quotes with />" do
      result = ERBX.lex(%(<img value="/>"/>))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_EQUALS
        TOKEN_HTML_QUOTE
        TOKEN_HTML_ATTRIBUTE_VALUE
        TOKEN_HTML_QUOTE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    xtest "attribute value single quotes with > value" do
      result = ERBX.lex(%(<img value='>'/>))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_EQUALS
        TOKEN_HTML_QUOTE
        TOKEN_HTML_ATTRIBUTE_VALUE
        TOKEN_HTML_QUOTE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    xtest "attribute value double quotes with > value" do
      result = ERBX.lex(%(<img value=">"/>))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_EQUALS
        TOKEN_HTML_QUOTE
        TOKEN_HTML_ATTRIBUTE_VALUE
        TOKEN_HTML_QUOTE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    xtest "attribute value single quotes with / value" do
      result = ERBX.lex(%(<img value='>'/>))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_EQUALS
        TOKEN_HTML_QUOTE
        TOKEN_HTML_ATTRIBUTE_VALUE
        TOKEN_HTML_QUOTE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    xtest "attribute value double quotes with / value" do
      result = ERBX.lex(%(<img value=">"/>))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_EQUALS
        TOKEN_HTML_QUOTE
        TOKEN_HTML_ATTRIBUTE_VALUE
        TOKEN_HTML_QUOTE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    xtest "attribute value double quotes with single quote value" do
      result = ERBX.lex(%(<img value="''"/>))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_EQUALS
        TOKEN_HTML_QUOTE
        TOKEN_HTML_ATTRIBUTE_VALUE
        TOKEN_HTML_QUOTE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    xtest "attribute value single quotes with double quote value" do
      result = ERBX.lex(%(<img value='""'/>))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_EQUALS
        TOKEN_HTML_QUOTE
        TOKEN_HTML_ATTRIBUTE_VALUE
        TOKEN_HTML_QUOTE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute value empty quotes followed by another attribute" do
      result = ERBX.lex(%(<img value="" required />))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_EQUALS
        TOKEN_HTML_QUOTE
        TOKEN_HTML_QUOTE
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "boolean attribute" do
      result = ERBX.lex("<img required />")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
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
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "boolean attribute without whitespace and without self-closing tag" do
      result = ERBX.lex("<img required>")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_TAG_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute with no quotes value and whitespace and self-closing tag" do
      result = ERBX.lex("<img value=hello />")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_EQUALS
        TOKEN_HTML_ATTRIBUTE_VALUE
        TOKEN_WHITESPACE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute with no quotes value, no whitespace and self-closing tag" do
      result = ERBX.lex("<img value=hello/>")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_EQUALS
        TOKEN_HTML_ATTRIBUTE_VALUE
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute with no quotes value, no whitespace, and non self-closing tag" do
      result = ERBX.lex("<div value=hello>")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_EQUALS
        TOKEN_HTML_ATTRIBUTE_VALUE
        TOKEN_HTML_TAG_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "boolean attribute without whitespace" do
      result = ERBX.lex("<img required/>")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "HTML comment with padding whitespace" do
      result = ERBX.lex(%(<!-- Hello World -->))

      expected = %w[
        TOKEN_HTML_COMMENT_START
        TOKEN_HTML_COMMENT_CONTENT
        TOKEN_HTML_COMMENT_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "HTML comment with no whitespace" do
      result = ERBX.lex(%(<!--Hello World-->))

      expected = %w[
        TOKEN_HTML_COMMENT_START
        TOKEN_HTML_COMMENT_CONTENT
        TOKEN_HTML_COMMENT_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end
  end
end
