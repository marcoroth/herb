# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class ERBTest < Minitest::Spec
    test "erb" do
      result = ERBX.lex(%(<% 'hello world' %>))

      expected = %w[
        TOKEN_ERB_START
        TOKEN_ERB_CONTENT
        TOKEN_ERB_END
        TOKEN_EOF
      ]

      assert_equal expected, result.array.items.map(&:type)
    end
  end
end
