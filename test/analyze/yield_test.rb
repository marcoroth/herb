# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class YieldTest < Minitest::Spec
    include SnapshotUtils

    test "yield" do
      assert_parsed_snapshot(<<~HTML)
        <%= yield %>
      HTML
    end

    test "yield with symbol" do
      assert_parsed_snapshot(<<~HTML)
        <%= yield :symbol %>
      HTML
    end
  end
end
