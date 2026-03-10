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

    test "block character in html content" do
      assert_parsed_snapshot(<<~ERB)
        <div>▌</div>
      ERB
    end

    test "emoji in html content" do
      assert_parsed_snapshot(<<~ERB)
        <div>🌿</div>
      ERB
    end

    test "multiple utf8 characters in html content" do
      assert_parsed_snapshot(<<~ERB)
        <div>▌🌿▌</div>
      ERB
    end

    test "mixed ascii and utf8 characters" do
      assert_parsed_snapshot(<<~ERB)
        <div>Hello ▌ World 🌿!</div>
      ERB
    end

    test "issue 327 reproduction case" do
      assert_parsed_snapshot(<<~ERB)
        <div>▌</div>
        <div>🌿</div>
      ERB
    end
  end
end
