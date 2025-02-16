# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class TagsTest < Minitest::Spec
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
        TOKEN_TEXT_CONTENT
        TOKEN_HTML_TAG_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "basic tag" do
      result = ERBX.lex("<html></html>")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_HTML_TAG_END
        TOKEN_HTML_TAG_START_CLOSE
        TOKEN_IDENTIFIER
        TOKEN_HTML_TAG_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "basic void tag" do
      result = ERBX.lex("<img />")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
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
        TOKEN_IDENTIFIER
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "namespaced tag" do
      result = ERBX.lex("<ns:table></ns:table>")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_HTML_TAG_END
        TOKEN_HTML_TAG_START_CLOSE
        TOKEN_IDENTIFIER
        TOKEN_HTML_TAG_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "colon inside html " do
      result = ERBX.lex(%(<div : class=""></div>))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_COLON
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_EQUALS
        TOKEN_QUOTE
        TOKEN_QUOTE
        TOKEN_HTML_TAG_END
        TOKEN_HTML_TAG_START_CLOSE
        TOKEN_IDENTIFIER
        TOKEN_HTML_TAG_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "text content" do
      result = ERBX.lex("<h1>Hello World</h1>")

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

    test "attribute with no quotes value and whitespace and self-closing tag" do
      result = ERBX.lex("<img value=hello />")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_EQUALS
        TOKEN_IDENTIFIER
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
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_EQUALS
        TOKEN_IDENTIFIER
        TOKEN_HTML_TAG_SELF_CLOSE
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "attribute with no quotes value, no whitespace, and non self-closing tag" do
      result = ERBX.lex("<div value=hello>")

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_IDENTIFIER
        TOKEN_WHITESPACE
        TOKEN_IDENTIFIER
        TOKEN_EQUALS
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
