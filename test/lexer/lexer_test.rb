# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class LexerTest < Minitest::Spec
    include SnapshotUtils

    test "nil" do
      assert_lexed_snapshot(nil)
    end

    test "empty file" do
      assert_lexed_snapshot("")
    end
  end
end
