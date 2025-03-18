# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class CaseTest < Minitest::Spec
    include SnapshotUtils

    test "case statement" do
      assert_parsed_snapshot(<<~HTML)
        <% case variable %>
        <% when String %>
          String
        <% end %>
      HTML
    end

    test "case statement with multiple when" do
      assert_parsed_snapshot(<<~HTML)
        <% case variable %>
        <% when String %>
          String
        <% when Integer %>
          Integer
        <% end %>
      HTML
    end

    test "case statement with else" do
      assert_parsed_snapshot(<<~HTML)
        <% case variable %>
        <% when String %>
          String
        <% else %>
          else
        <% end %>
      HTML
    end

    test "case statement with multiple when and else" do
      assert_parsed_snapshot(<<~HTML)
        <% case variable %>
        <% when String %>
          String
        <% when Integer %>
          Integer
        <% else %>
          else
        <% end %>
      HTML
    end

    test "case statement wrapped in element" do
      assert_parsed_snapshot(<<~HTML)
        <h1>
          <% case variable %>
          <% when String %>
            String
          <% when Integer %>
            Integer
          <% else %>
            else
          <% end %>
        </h1>
      HTML
    end

    test "nested cases" do
      skip

      assert_parsed_snapshot(<<~HTML)
        <% case variable %>
        <% when String %>
          String

          <% case variable %>
          <% when Integer %>
            Integer
          <% end %>
        <% end %>
      HTML
    end

    test "case with children before first when" do
      assert_parsed_snapshot(<<~HTML)
        <% case variable %>
          before when
        <% when String %>
          String
        <% end %>
      HTML
    end
  end
end
