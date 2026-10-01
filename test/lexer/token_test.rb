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

    test "multiple whitespace with newlines " do
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

    test "range and location are materialized and memoized on first access" do
      token = Herb.lex("<div>").value.first

      assert_equal [:@location_data], token.instance_variables - [:@value, :@type]
      assert_equal false, token.instance_variables.include?(:@range)
      assert_equal false, token.instance_variables.include?(:@location)

      GC.start

      range = token.range
      assert_instance_of Herb::Range, range
      assert_same range, token.range
      assert_equal true, token.instance_variables.include?(:@range)
      assert_equal false, token.instance_variables.include?(:@location)

      location = token.location
      assert_instance_of Herb::Location, location
      assert_instance_of Herb::Position, location.start
      assert_instance_of Herb::Position, location.end
      assert_same location, token.location
      assert_equal true, token.instance_variables.include?(:@location)
      assert_nil token.instance_variable_get(:@location_data)

      location_first_token = Herb.lex("<div>").value.first
      location_first_token.location

      assert_equal true, location_first_token.instance_variables.include?(:@location)
      assert_equal false, location_first_token.instance_variables.include?(:@range)
      assert_instance_of Herb::Range, location_first_token.range
      assert_nil location_first_token.instance_variable_get(:@location_data)
    end
  end
end
