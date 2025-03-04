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
  end
end
