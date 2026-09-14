# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class ERBRubyLiteralsTest < Minitest::Spec
    include SnapshotUtils

    test "single-quoted string containing erb-like content" do
      assert_parsed_snapshot(%q(<% x = '<%' %>))
    end

    test "double-quoted string containing erb-like content" do
      assert_parsed_snapshot(%q(<% x = "<%" %>))
    end

    test "single-quoted string containing balanced erb pair" do
      assert_parsed_snapshot(%q(<% x = '<% ignore %>' %>))
    end

    test "double-quoted string with escaped quote before erb-like content" do
      assert_parsed_snapshot(%q(<% x = "\"<%" %>))
    end

    test "double-quoted string with interpolation followed by erb-like content" do
      assert_parsed_snapshot(%q(<% x = "#{a}<%" %>))
    end

    test "backtick string containing erb-like content" do
      assert_parsed_snapshot(%q(<% x = `<%` %>))
    end

    test "line comment containing erb-like content" do
      assert_parsed_snapshot("<% # <%\n %>")
    end

    test "nested erb tag without ruby string still errors" do
      assert_parsed_snapshot(%q(<%<% %>))
    end
  end
end
