# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class UnlessTest < Minitest::Spec
    include SnapshotUtils

    test "unless statement" do
      assert_parsed_snapshot(<<~HTML)
        <% unless true %>
          true
        <% end %>
      HTML
    end

    test "unless statement wrapped in element" do
      assert_parsed_snapshot(<<~HTML)
        <h1>
          <% unless true %>
            true
          <% end %>
        </h1>
      HTML
    end

    test "unless statement with multiple children" do
      assert_parsed_snapshot(<<~HTML)
        <% unless true %>
          <h1>true</h1>
          <h2>true</h2>
        <% end %>
      HTML
    end

    test "unless statement with multiple children wrapped in element" do
      assert_parsed_snapshot(<<~HTML)
        <h1>
          <% unless true %>
            <h2>true</h2>
            <h3>true</h3>
          <% end %>
        </h1>
      HTML
    end

    test "unless statement with else" do
      assert_parsed_snapshot(<<~HTML)
        <% unless true %>
          true
        <% else %>
          else
        <% end %>
      HTML
    end

    test "nested unless statements" do
      assert_parsed_snapshot(<<~HTML)
        <% unless true %>
          true

          <% unless false %>
            false
          <% end %>
        <% end %>
      HTML
    end
  end
end
