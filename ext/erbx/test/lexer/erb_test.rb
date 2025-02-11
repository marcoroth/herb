# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class ERBTest < Minitest::Spec
    test "erb silent" do
      result = ERBX.lex(%(<% 'hello world' %>))

      expected = %w[
        TOKEN_ERB_START
        TOKEN_ERB_CONTENT
        TOKEN_ERB_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "erb loud" do
      result = ERBX.lex(%(<%= "hello world" %>))

      expected = %w[
        TOKEN_ERB_START
        TOKEN_ERB_CONTENT
        TOKEN_ERB_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "erb <%-" do
      result = ERBX.lex(%(<%- "Test" %>))

      expected = %w[
        TOKEN_ERB_START
        TOKEN_ERB_CONTENT
        TOKEN_ERB_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "erb <%- -%>" do
      result = ERBX.lex(%(<%- "Test" -%>))

      expected = %w[
        TOKEN_ERB_START
        TOKEN_ERB_CONTENT
        TOKEN_ERB_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    test "erb <%# %>" do
      result = ERBX.lex(%(<%# "Test" %>))

      expected = %w[
        TOKEN_ERB_START
        TOKEN_ERB_CONTENT
        TOKEN_ERB_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    xtest "erb <%% %%>" do
      result = ERBX.lex(%(<%% "Test" %%>))

      expected = %w[
        TOKEN_ERB_START
        TOKEN_ERB_CONTENT
        TOKEN_ERB_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    xtest "erb output inside HTML attribute value" do
      result = ERBX.lex(%(<article id="<%= dom_id(article) %>"></article>))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_EQUALS
        TOKEN_HTML_QUOTE
        TOKEN_ERB_START
        TOKEN_ERB_CONTENT
        TOKEN_ERB_END
        TOKEN_HTML_QUOTE
        TOKEN_HTML_TAG_END
        TOKEN_HTML_CLOSE_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_ERB_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    xtest "erb output inside HTML attribute value with value before" do
      result = ERBX.lex(%(<div class="bg-black <%= "text-white" %>"></div>))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_EQUALS
        TOKEN_HTML_QUOTE
        TOKEN_HTML_ATTRIBUTE_VALUE
        TOKEN_ERB_START
        TOKEN_ERB_CONTENT
        TOKEN_ERB_END
        TOKEN_HTML_QUOTE
        TOKEN_HTML_TAG_END
        TOKEN_HTML_CLOSE_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_ERB_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    xtest "erb output inside HTML attribute value with value before and after" do
      result = ERBX.lex(%(<div class="bg-black <%= "text-white" %>"></div>))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_EQUALS
        TOKEN_HTML_QUOTE
        TOKEN_HTML_ATTRIBUTE_VALUE
        TOKEN_ERB_START
        TOKEN_ERB_CONTENT
        TOKEN_ERB_END
        TOKEN_HTML_ATTRIBUTE_VALUE
        TOKEN_HTML_QUOTE
        TOKEN_HTML_TAG_END
        TOKEN_HTML_CLOSE_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_ERB_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end

    xtest "erb output inside HTML attribute value with value and after" do
      result = ERBX.lex(%(<div class="bg-black <%= "text-white" %>"></div>))

      expected = %w[
        TOKEN_HTML_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_WHITESPACE
        TOKEN_HTML_ATTRIBUTE_NAME
        TOKEN_HTML_EQUALS
        TOKEN_HTML_QUOTE
        TOKEN_ERB_START
        TOKEN_ERB_CONTENT
        TOKEN_ERB_END
        TOKEN_HTML_ATTRIBUTE_VALUE
        TOKEN_HTML_QUOTE
        TOKEN_HTML_TAG_END
        TOKEN_HTML_CLOSE_TAG_START
        TOKEN_HTML_TAG_NAME
        TOKEN_ERB_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end
  end
end
