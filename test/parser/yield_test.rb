# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class YieldTest < Minitest::Spec
    include SnapshotUtils

    test "yield" do
      assert_parsed_snapshot(<<~HTML)
        <%= yield %>
      HTML
    end

    test "yield with symbol" do
      assert_parsed_snapshot(<<~HTML)
        <%= yield :head %>
      HTML
    end

    test "yield inside if" do
      assert_parsed_snapshot(<<~HTML)
        <% if content_for?(:header) %>
          <div class="hidden">
            <%= yield :header %>
          </div>
        <% end %>
      HTML
    end

    test "yield inside block" do
      assert_parsed_snapshot(<<~HTML)
        <% container do %>
          <%= yield :content %>
        <% end %>
      HTML
    end

    test "yield inside case/when" do
      assert_parsed_snapshot(<<~HTML)
        <% case a %>
        <% when String %>
          <%= yield :string %>
        <% when Integer %>
          <%= yield :integer %>
        <% end %>
      HTML
    end
  end
end
