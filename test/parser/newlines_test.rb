# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class NewlinesTest < Minitest::Spec
    include SnapshotUtils

    test "line feed" do
      assert_parsed_snapshot("\n")
    end

    test "carriage return" do
      assert_parsed_snapshot("\r")
    end

    test "carriage return and line feed" do
      assert_parsed_snapshot("\r\n")
    end
  end
end
