# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class UTF8Test < Minitest::Spec
    include SnapshotUtils

    test "opening guillemet" do
      assert_parsed_snapshot(<<~ERB)
        <%= link_to '«', url %>
      ERB
    end

    test "closing guillemet" do
      assert_parsed_snapshot(<<~ERB)
        <%= link_to '»', url %>
      ERB
    end

    test "single opening guillemet" do
      assert_parsed_snapshot(<<~ERB)
        <%= link_to '‹', url %>
      ERB
    end

    test "single closing guillemet" do
      assert_parsed_snapshot(<<~ERB)
        <%= link_to '›', url %>
      ERB
    end
  end
end
