# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::UrlHelper
  class LinkToTest < Minitest::Spec
    include SnapshotUtils

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

    test "link_to with block and path helper" do
      assert_parsed_snapshot(<<~HTML)
        <%= link_to root_path do %>
          <span class="icon">🏠</span>
          Home
        <% end %>
      HTML
    end

    test "link_to with block and html options" do
      assert_parsed_snapshot(<<~HTML)
        <%= link_to "#", class: "btn btn-primary", id: "home-link" do %>
          Click me
        <% end %>
      HTML
    end

    test "link_to with block and data attributes" do
      assert_parsed_snapshot(<<~HTML)
        <%= link_to root_path, data: { controller: "hello", action: "click" } do %>
          Interactive Link
        <% end %>
      HTML
    end

    test "link_to with block and complex attributes" do
      assert_parsed_snapshot(<<~HTML)
        <%= link_to root_path, class: "btn", data: { turbo_method: "delete", confirm: "Are you sure?" }, method: "delete" do %>
          <i class="icon-trash"></i>
          Delete
        <% end %>
      HTML
    end

    test "link_to with block and nested html" do
      assert_parsed_snapshot(<<~HTML)
        <%= link_to "/profile" do %>
          <div class="user-card">
            <img src="avatar.jpg" alt="Avatar">
            <span>John Doe</span>
          </div>
        <% end %>
      HTML
    end
  end
end
