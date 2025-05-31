# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class CaseInTest < Minitest::Spec
    include SnapshotUtils

    test "case in statement" do
      assert_parsed_snapshot(<<~HTML)
        <% case variable %>
        <% in [Integer] %>
          Integer
        <% else %>
          else
        <% end %>
      HTML
    end

    test "case in statement with multiple in" do
      assert_parsed_snapshot(<<~HTML)
        <% case variable %>
        <% in [String] %>
          String
        <% in [Integer] %>
          Integer
        <% end %>
      HTML
    end

    test "case in statement with else" do
      assert_parsed_snapshot(<<~HTML)
        <% case variable %>
        <% in [String] %>
          String
        <% else %>
          else
        <% end %>
      HTML
    end

    test "case in statement with multiple in and else" do
      assert_parsed_snapshot(<<~HTML)
        <% case variable %>
        <% in [String] %>
          String
        <% in [Integer] %>
          Integer
        <% else %>
          else
        <% end %>
      HTML
    end

    test "case in statement wrapped in element" do
      assert_parsed_snapshot(<<~HTML)
        <h1>
          <% case variable %>
          <% in [String] %>
            String
          <% in [Integer] %>
            Integer
          <% else %>
            else
          <% end %>
        </h1>
      HTML
    end

    test "nested cases ins" do
      skip

      assert_parsed_snapshot(<<~HTML)
        <% case variable %>
        <% in [String] %>
          String

          <% case variable %>
          <% in [Integer] %>
            Integer
          <% end %>
        <% end %>
      HTML
    end

    test "case in with children before first in" do
      assert_parsed_snapshot(<<~HTML)
        <% case variable %>
          before in
        <% in [String] %>
          String
        <% end %>
      HTML
    end
  end
end
