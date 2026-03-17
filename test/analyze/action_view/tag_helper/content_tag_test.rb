# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::TagHelper
  class ContentTagTest < Minitest::Spec
    include SnapshotUtils

    test "content_tag" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag :div do %>
          Content
        <% end %>
      HTML
    end

    test "content_tag with content as argument" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag :div, "Content" %>
      HTML
    end

    test "content_tag with attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag :div, class: "content" do %>
          Content
        <% end %>
      HTML
    end

    test "content_tag with content as argument and attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag :div, "Content", class: "example" %>
      HTML
    end

    test "content_tag with data attributes in hash style" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag :div, data: { controller: "example", user_id: 123 } do %>
          Content
        <% end %>
      HTML
    end

    test "content_tag with data attributes using string key hashrocket" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag :div, data: { "action" => "value" } %>
      HTML
    end

    test "content_tag with data attributes using symbol key hashrocket" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag :div, data: { :action => "value" } %>
      HTML
    end

    test "content_tag with attributes in string key hash style" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag :div, "data-controller" => "example", "data-user-id": 123 do %>
          Content
        <% end %>
      HTML
    end

    test "content_tag with data attributes in underscore style" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag :div, data_controller_name: "example", data_user_id: 123 do %>
          Content
        <% end %>
      HTML
    end

    test "content_tag with data attributes in string key hash style" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag :div, "Content", data: { "controller-name" => "example", "user-id" => 123 } do %>
          Content
        <% end %>
      HTML
    end

    test "content_tag with variable tag name" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag tag_name do %>
          Content
        <% end %>
      HTML
    end

    test "content_tag with variable attribute value" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag :div, class: class_name do %>
          Content
        <% end %>
      HTML
    end

    test "content_tag with attributes splat" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag :div, class: "content", **attributes do %>
          Content
        <% end %>
      HTML
    end

    test "content_tag with void element br" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag :br %>
      HTML
    end

    test "content_tag with void element hr with attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag :hr, class: "divider" %>
      HTML
    end

    test "content_tag with void element img with attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag :img, src: "/image.png", alt: "Photo" %>
      HTML
    end

    test "content_tag with void element img with attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag tag_name, "Content" %>
      HTML
    end

    test "content_tag with splat in data hash" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag :div, data: { controller: "example", **data_attrs } do %>
          Content
        <% end %>
      HTML
    end

    test "content_tag with splat in aria hash" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag :div, aria: { label: "hello", **aria_attrs } do %>
          Content
        <% end %>
      HTML
    end

    test "content_tag with only splat in data hash" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag :div, data: { **data_attrs } do %>
          Content
        <% end %>
      HTML
    end

    test "content_tag with inline block" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag(:details) { "Some content" } %>
      HTML
    end

    test "content_tag with inline block and attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag(:div, class: "container") { "Hello" } %>
      HTML
    end

    test "content_tag with inline block and ruby expression" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag(:p) { @user.name } %>
      HTML
    end

    test "content_tag with inline block and symbol tag name" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= content_tag(:span) { "Text" } %>
      HTML
    end
  end
end
