# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class BlockTest < Minitest::Spec
    include SnapshotUtils

    test "single line block" do
      assert_parsed_snapshot(<<~HTML)
        <% numbers.map { |number| number * 2 } %>
      HTML
    end

    test "block" do
      assert_parsed_snapshot(<<~HTML)
        <% block do %>
          Content
        <% end %>
      HTML
    end

    test "block with curlies" do
      assert_parsed_snapshot(<<~HTML)
        <% block { %>
          Content
        <% } %>
      HTML
    end

    test "block wrapped in element" do
      assert_parsed_snapshot(<<~HTML)
        <h1>
          <% block do %>
            Content
          <% end %>
        </h1>
      HTML
    end

    test "each block" do
      assert_parsed_snapshot(<<~HTML)
        <% [1, 2, 3].each do |item| %>
          <%= item %>
        <% end %>
      HTML
    end

    test "each_with_index block" do
      assert_parsed_snapshot(<<~HTML)
        <% [1, 2, 3].each_with_index do |item, index| %>
          <%= item %>
          <%= index %>
        <% end %>
      HTML
    end

    test "times block" do
      assert_parsed_snapshot(<<~HTML)
        <% 5.times do |i| %>
          <%= i %>
        <% end %>
      HTML
    end

    test "upto block" do
      assert_parsed_snapshot(<<~HTML)
        <% 1.upto(5) do |i| %>
          <%= i %>
        <% end %>
      HTML
    end

    test "step block" do
      assert_parsed_snapshot(<<~HTML)
        <% 1.step(5, 2) do |i| %>
          <%= i %>
        <% end %>
      HTML
    end

    test "loop block" do
      assert_parsed_snapshot(<<~HTML)
        <% loop do %>
          loop
        <% end %>
      HTML
    end

    test "nested blocks" do
      assert_parsed_snapshot(<<~HTML)
        <% block do %>
          Level 1

          <% block do %>
            Level 2
          <% end %>
        <% end %>
      HTML
    end
  end
end
