# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::TagHelper
  class TagTest < Minitest::Spec
    include SnapshotUtils

    test "tag.div with block" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div do %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with content as argument" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div "Content" %>
      HTML
    end

    test "tag.div with attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div class: "content" do  %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with content as argument and attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div "Content", class: "content" %>
      HTML
    end

    test "tag.div with data attributes in hash style" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div data: { controller: "content", user_id: 123 } do %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with attributes in string key hash style" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div "data-controller" => "example", "data-user-id": 123 do %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with data attributes in underscore style" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div data_controller_name: "content", data_user_id: 123 do %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with data attributes in string key hash style" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div data: { "controller-name" => "example", "user-id" => 123 } do %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with variable attribute value" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div class: class_name do %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with attributes splat" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div class: "content", **attributes do %>
          Content
        <% end %>
      HTML
    end

    test "tag.br void element" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.br %>
      HTML
    end

    test "tag.hr void element with attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.hr class: "divider" %>
      HTML
    end

    test "tag.img void element with attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.img src: "/image.png", alt: "Photo" %>
      HTML
    end

    test "tag.div with attributes in string key hash style without block" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div "data-controller" => "example", "data-user-id": 123 %>
      HTML
    end

    test "tag.div with splat in data hash" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div data: { controller: "example", **data_attrs } do %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with splat in aria hash" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div aria: { label: "hello", **aria_attrs } do %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with only splat in data hash" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div data: { **data_attrs } do %>
          Content
        <% end %>
      HTML
    end
  end
end
