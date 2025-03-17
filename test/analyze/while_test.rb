# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class WhileTest < Minitest::Spec
    include SnapshotUtils

    test "while statement" do
      assert_parsed_snapshot(<<~HTML)
        <% while true %>
          true
        <% end %>
      HTML
    end

    test "while statement wrapped in element" do
      assert_parsed_snapshot(<<~HTML)
        <h1>
          <% while true %>
            true
          <% end %>
        </h1>
      HTML
    end

    test "while statement with multiple children" do
      assert_parsed_snapshot(<<~HTML)
        <% while true %>
          <h1>true</h1>
          <h2>true</h2>
        <% end %>
      HTML
    end

    test "while statement with multiple children wrapped in element" do
      assert_parsed_snapshot(<<~HTML)
        <h1>
          <% while true %>
            <h2>true</h2>
            <h3>true</h3>
          <% end %>
        </h1>
      HTML
    end

    test "while statement with multiple children and multiple while" do
      assert_parsed_snapshot(<<~HTML)
        <% while true %>
          <h1>true</h1>
          <h2>true</h2>

          <% while false %>
            <h3>false</h3>
          <% end %>
        <% end %>
      HTML
    end

    test "while statement with break" do
      assert_parsed_snapshot(<<~HTML)
        <% while true %>
          true

          <% break %>
        <% end %>
      HTML
    end

    test "while statement with next" do
      assert_parsed_snapshot(<<~HTML)
        <% while true %>
          true

          <% next %>
        <% end %>
      HTML
    end

    test "while statement with redo" do
      assert_parsed_snapshot(<<~HTML)
        <% while true %>
          true

          <% redo %>
        <% end %>
      HTML
    end

    test "while statement with retry" do
      assert_parsed_snapshot(<<~HTML)
        <% while true %>
          true

          <% retry %>
        <% end %>
      HTML
    end

    test "nested while statements" do
      assert_parsed_snapshot(<<~HTML)
        <% while true %>
          true

          <% while false %>
            false
          <% end %>
        <% end %>
      HTML
    end
  end
end
