# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class TokenTest < Minitest::Spec
    include SnapshotUtils

    test "whitespace" do
      assert_lexed_snapshot(" ")
    end

    test "multiple whitespace" do
      assert_lexed_snapshot("    ")
    end

    test "multiple whitespace with newliens " do
      assert_lexed_snapshot(" \n  \n   \n")
    end

    test "non-breaking space" do
      assert_lexed_snapshot(" ")
    end

    test "newline" do
      assert_lexed_snapshot("\n")
    end

    test "!" do
      assert_lexed_snapshot("!")
    end

    test "slash" do
      assert_lexed_snapshot("/")
    end

    test "dash" do
      assert_lexed_snapshot("-")
    end

    test "underscore" do
      assert_lexed_snapshot("_")
    end

    test "percent" do
      assert_lexed_snapshot("%")
    end

    test "colon" do
      assert_lexed_snapshot(":")
    end

    test "equals" do
      assert_lexed_snapshot("=")
    end

    test "double quote" do
      assert_lexed_snapshot(%("))
    end

    test "single quote" do
      assert_lexed_snapshot(%('))
    end

    test "less than signs" do
      assert_lexed_snapshot("<<<<")
    end

    test "greater than signs" do
      assert_lexed_snapshot(">>>>")
    end

    test "LT, GT and PERCENT signs" do
      assert_lexed_snapshot(%(< % % >))
    end
  end
end
