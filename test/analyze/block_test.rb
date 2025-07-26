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

    test "output block with nested if in arguments" do
      assert_parsed_snapshot(<<~HTML)
        <%= link_to(some_url, class: ("some-class" if some_condition)) do %>
          Click me
        <% end %>
      HTML
    end

    test "output block with complex nested if in arguments" do
      assert_parsed_snapshot(<<~HTML)
        <%= form_builder.fieldset(
          "foo",
          :foo,
          required: true,
          hint:
            if some_condition?
              "foo"
            else
              "bar"
            end
        ) do %>
            <%# ... %>
        <% end %>
      HTML
    end

    test "output block with ternary in arguments" do
      assert_parsed_snapshot(<<~HTML)
        <%= button_to(path, class: active? ? "active" : "inactive") do %>
          Button text
        <% end %>
      HTML
    end

    test "non-output block with nested if in arguments" do
      assert_parsed_snapshot(<<~HTML)
        <% link_to(some_url, class: ("some-class" if some_condition)) do %>
          Click me
        <% end %>
      HTML
    end

    test "block with multiple nested control structures" do
      assert_parsed_snapshot(<<~HTML)
        <%= items.select { |item| item.valid? }.map do |item| %>
          <div class="<%= item.active? ? 'active' : 'inactive' %>">
            <%= item.name %>
          </div>
        <% end %>
      HTML
    end

    test "output block with nested if and empty body" do
      assert_parsed_snapshot(<<~HTML)
        <%= link_to(some_url, class: ("some-class" if some_condition)) do %>

        <% end %>
      HTML
    end

    test "yield with conditional expression" do
      assert_parsed_snapshot(<<~HTML)
        <%= yield(:header) if content_for?(:header) %>
      HTML
    end
  end
end
