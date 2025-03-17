# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class ForTest < Minitest::Spec
    include SnapshotUtils

    test "for loop" do
      assert_parsed_snapshot(<<~HTML)
        <% for i in 1..5 %>
          <%= i %>
        <% end %>
      HTML
    end

    test "for loop with children" do
      assert_parsed_snapshot(<<~HTML)
        <% for fruit in ["apple", "banana", "orange"] %>
          <%= fruit %>
        <% end %>
      HTML
    end

    test "for loop wrapped in element" do
      assert_parsed_snapshot(<<~HTML)
        <h1>
          <% for i in 1..5 %>
            <%= i %>
          <% end %>
        </h1>
      HTML
    end

    test "nested for loops" do
      assert_parsed_snapshot(<<~HTML)
        <% for i in 1..5 %>
          <% for j in 1..5 %>
            <%= i %>, <%= j %>
          <% end %>
        <% end %>
      HTML
    end
  end
end
