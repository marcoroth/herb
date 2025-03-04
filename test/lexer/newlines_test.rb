# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class NewlinesTest < Minitest::Spec
    include SnapshotUtils

    test "line feed" do
      assert_lexed_snapshot("\n")
    end

    test "carriage return" do
      assert_lexed_snapshot("\r")
    end

    test "carriage return and line feed" do
      assert_lexed_snapshot("\r\n")
    end
  end
end
