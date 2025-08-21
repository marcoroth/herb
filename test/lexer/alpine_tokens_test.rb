# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class AlpineTokensTest < Minitest::Spec
    test "lexes @ as TOKEN_AT" do
      result = Herb.lex("<div @click>")
      tokens = result.value

      at_token = tokens.find { |t| t.value == "@" }

      assert_equal "TOKEN_AT", at_token.type
      assert_equal "@", at_token.value
    end

    test "lexes : as TOKEN_COLON in attributes" do
      result = Herb.lex("<div :class>")
      tokens = result.value

      colon_token = tokens.find { |t| t.value == ":" }

      assert_equal "TOKEN_COLON", colon_token.type
      assert_equal ":", colon_token.value
    end

    test "lexes @ followed by identifier" do
      result = Herb.lex("<div @click>")
      tokens = result.value

      at_index = tokens.index { |t| t.value == "@" }
      assert at_index, "Should find @ token"

      at_token = tokens[at_index]
      click_token = tokens[at_index + 1]

      assert_equal "TOKEN_AT", at_token.type
      assert_equal "@", at_token.value

      assert_equal "TOKEN_IDENTIFIER", click_token.type
      assert_equal "click", click_token.value
    end

    test "lexes : followed by identifier" do
      result = Herb.lex("<div :value>")
      tokens = result.value

      colon_index = tokens.index { |t| t.value == ":" }
      assert colon_index, "Should find : token"

      colon_token = tokens[colon_index]
      value_token = tokens[colon_index + 1]

      assert_equal "TOKEN_COLON", colon_token.type
      assert_equal ":", colon_token.value

      assert_equal "TOKEN_IDENTIFIER", value_token.type
      assert_equal "value", value_token.value
    end

    test "lexes complex Alpine.js expression" do
      result = Herb.lex('<div @click="handleClick" :class="{ active: isActive }"></div>')
      tokens = result.value

      at_token = tokens.find { |t| t.value == "@" }
      assert at_token, "Should find @ token"
      assert_equal "TOKEN_AT", at_token.type

      colon_tokens = tokens.select { |t| t.value == ":" }
      assert colon_tokens.size >= 1, "Should find at least one : token"

      attribute_colon = colon_tokens.first
      assert_equal "TOKEN_COLON", attribute_colon.type
    end
  end
end
