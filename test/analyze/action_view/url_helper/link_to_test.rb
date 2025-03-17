# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::UrlHelper
  class LinkToTest < Minitest::Spec
    include SnapshotUtils

    before do
      skip
    end

    test "link_to" do
      assert_parsed_snapshot(<<~HTML)
        <%= link_to "Click me", "#" %>
      HTML
    end

    test "link_to with html options" do
      assert_parsed_snapshot(<<~HTML)
        <%= link_to "Click me", "#", class: "example" %>
      HTML
    end

    test "link_to with block" do
      assert_parsed_snapshot(<<~HTML)
        <%= link_to "#" do %>
          Click me
        <% end %>
      HTML
    end

    test "link_to with path helper" do
      assert_parsed_snapshot(<<~HTML)
        <%= link_to "Click me", root_path %>
      HTML
    end

    test "link_to with method" do
      assert_parsed_snapshot(<<~HTML)
        <%= link_to "Delete", root_path, method: "delete" %>
      HTML
    end

    test "link_to with confirm" do
      assert_parsed_snapshot(<<~HTML)
        <%= link_to "Delete", root_path, data: { confirm: "Are you sure?" } %>
      HTML
    end

    test "link_to with data-turbo-method" do
      assert_parsed_snapshot(<<~HTML)
        <%= link_to "Delete", root_path, data: { turbo_method: "delete" } %>
      HTML
    end

    test "link_to with data-turbo-confirm" do
      assert_parsed_snapshot(<<~HTML)
        <%= link_to "Delete", root_path, data: { turbo_confirm: "Are you sure?" } %>
      HTML
    end

    test "link_to with :back" do
      assert_parsed_snapshot(<<~HTML)
        <%= link_to "Back", :back %>
      HTML
    end
  end
end
