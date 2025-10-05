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

    test "case with block inside when" do
      assert_parsed_snapshot(<<~HTML)
        <% case 1 %>
        <% when 1 %>
          <%= content_tag(:p) do %>
            Yep
          <% end %>
        <% end %>
      HTML
    end

    test "case with multiple blocks in when" do
      assert_parsed_snapshot(<<~HTML)
        <% case status %>
        <% when :active %>
          <%= content_tag(:div) do %>
            Active
          <% end %>
          <%= content_tag(:span) do %>
            Badge
          <% end %>
        <% end %>
      HTML
    end

    test "case with nested blocks in when" do
      assert_parsed_snapshot(<<~HTML)
        <% case level %>
        <% when 1 %>
          <%= content_tag(:div) do %>
            <%= content_tag(:p) do %>
              Nested
            <% end %>
          <% end %>
        <% end %>
      HTML
    end

    test "case with block in multiple when clauses" do
      assert_parsed_snapshot(<<~HTML)
        <% case type %>
        <% when :a %>
          <%= form_for(obj) do |f| %>
            Form A
          <% end %>
        <% when :b %>
          <%= form_for(obj) do |f| %>
            Form B
          <% end %>
        <% end %>
      HTML
    end

    test "case with if statement inside when" do
      assert_parsed_snapshot(<<~HTML)
        <% case status %>
        <% when :active %>
          <% if admin? %>
            Admin view
          <% end %>
        <% end %>
      HTML
    end
  end
end
