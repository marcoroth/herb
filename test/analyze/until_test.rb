# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class UntilTest < Minitest::Spec
    include SnapshotUtils

    test "until statement" do
      assert_parsed_snapshot(<<~HTML)
        <% until true %>
          true
        <% end %>
      HTML
    end

    test "until statement wrapped in element" do
      assert_parsed_snapshot(<<~HTML)
        <h1>
          <% until true %>
            true
          <% end %>
        </h1>
      HTML
    end

    test "until statement with multiple children" do
      assert_parsed_snapshot(<<~HTML)
        <% until true %>
          <h1>true</h1>
          <h2>true</h2>
        <% end %>
      HTML
    end

    test "until statement with multiple children wrapped in element" do
      assert_parsed_snapshot(<<~HTML)
        <h1>
          <% until true %>
            <h2>true</h2>
            <h3>true</h3>
          <% end %>
        </h1>
      HTML
    end

    test "nested until statements" do
      assert_parsed_snapshot(<<~HTML)
        <% until true %>
          true

          <% until false %>
            false
          <% end %>
        <% end %>
      HTML
    end

    test "until statement with break" do
      assert_parsed_snapshot(<<~HTML)
        <% until true %>
          true

          <% break %>
        <% end %>
      HTML
    end

    test "until statement with next" do
      assert_parsed_snapshot(<<~HTML)
        <% until true %>
          true

          <% next %>
        <% end %>
      HTML
    end
  end
end
