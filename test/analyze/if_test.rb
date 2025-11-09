# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class IfTest < Minitest::Spec
    include SnapshotUtils

    test "if statement" do
      assert_parsed_snapshot(<<~HTML)
        <% if true %>
        <% end %>
      HTML
    end

    test "if/else statement" do
      assert_parsed_snapshot(<<~HTML)
        <% if true %>
        <% else %>
        <% end %>
      HTML
    end

    test "if/elsif/else statement" do
      assert_parsed_snapshot(<<~HTML)
        <% if true %>
        <% elsif false %>
        <% else %>
        <% end %>
      HTML
    end

    test "if/elsif/elsif/else statement" do
      assert_parsed_snapshot(<<~HTML)
        <% if true %>
        <% elsif false %>
        <% elsif nil %>
        <% else %>
        <% end %>
      HTML
    end

    test "if/elsif/else statement with children" do
      assert_parsed_snapshot(<<~HTML)
        <% if true %>
          <h1>true</h1>
        <% elsif false %>
          <h1>false</h1>
        <% else %>
          <h1>else</h1>
        <% end %>
      HTML
    end

    test "if/elsif/else statement wrapped in element" do
      assert_parsed_snapshot(<<~HTML)
        <h1>
          <% if true %>
            true
          <% elsif false %>
            false
          <% else %>
            else
          <% end %>
        </h1>
      HTML
    end

    test "nested if statements" do
      assert_parsed_snapshot(<<~HTML)
        <% if true %>
          <% if false %>
            <% if nil %>
              true & false & nil
            <% end %>
          <% end %>
        <% end %>
      HTML
    end

    test "if/else statement in opening tag value" do
      assert_parsed_snapshot(<<~HTML)
        <h1
          <% if id? %>
            id="title"
          <% end %>
        ></h1>
      HTML
    end

    test "if/else statement in attribute value" do
      assert_parsed_snapshot(<<~HTML)
        <h1 class="<% if bold? %>bold<% else %>normal<% end %>"></h1>
      HTML
    end

    test "guard clause with if modifier should not be parsed as ERBIfNode" do
      assert_parsed_snapshot(<<~HTML)
        <% [1,2].each do |value| %>
          <% next if false %>
          <div></div>
        <% end %>
      HTML
    end

    test "guard clause with return if modifier" do
      skip "we cannot detect MethodDefinitions yet"

      assert_parsed_snapshot(<<~HTML)
        <% def some_method %>
          <% return if true %>
          <div>This won't render</div>
        <% end %>
      HTML
    end

    test "guard clause with break if modifier" do
      assert_parsed_snapshot(<<~HTML)
        <% loop do %>
          <% break if condition %>
          <div>Loop content</div>
        <% end %>
      HTML
    end

    test "ERB if/end embedded in attribute name without space" do
      skip "<% if valid? %> gets joined to the disabled attribute, but the if contains a space inside the if body"

      assert_parsed_snapshot(<<~HTML)
        <button
          type="submit"
          disabled<% if valid? %> shouldn't be part of disabled<% end %>
        ></button>
      HTML
    end

    test "conditional attribute value" do
      skip

      assert_parsed_snapshot(<<~HTML)
        <button
          type="submit"
          disabled<% if valid? %>="disabled"<% end %>
        ></button>
      HTML
    end
  end
end
