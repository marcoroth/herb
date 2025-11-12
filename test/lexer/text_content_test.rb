# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class TextContentTest < Minitest::Spec
    include SnapshotUtils

    test "text content" do
      assert_lexed_snapshot("<h1>Some Text</h1>")
    end

    test "text content with period" do
      assert_lexed_snapshot("<h1>Some. Text.</h1>")
    end

    test "text content that exceeds initial hb_buffer_T size and needs to resize once (ca. 4K)" do
      initial_hb_buffer_capacity = 1024 # bytes
      content = cyclic_string((((initial_hb_buffer_capacity * 2) + 1) * 2) + 1)
      result = assert_lexed_snapshot(%(<div>#{content}</div>))

      identifier = result.value.find { |token| token.type == "TOKEN_IDENTIFIER" && token.value.length > 4000 }
      assert_equal content, identifier.value
    end

    test "text content that exceeds initial hb_buffer_T size and needs to resize twice (ca. 8K)" do
      initial_hb_buffer_capacity = 1024 # bytes
      content = cyclic_string((((((initial_hb_buffer_capacity * 2) + 1) * 2) + 1) * 2) + 1)
      result = assert_lexed_snapshot(%(<div>#{content}</div>))

      identifier = result.value.find { |token| token.type == "TOKEN_IDENTIFIER" && token.value.length > 4000 }
      assert_equal content, identifier.value
    end
  end
end
