# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::TagHelper
  class ContentTagTest < Minitest::Spec
    include SnapshotUtils

    before do
      skip
    end

    test "content_tag" do
      assert_parsed_snapshot(<<~HTML)
        <%= content_tag :div %>
          Content
        <% end %>
      HTML
    end

    test "content_tag with content as argument" do
      assert_parsed_snapshot(<<~HTML)
        <%= content_tag :div, "Content" %>
      HTML
    end

    test "content_tag with attributes" do
      assert_parsed_snapshot(<<~HTML)
        <%= content_tag :div, class: "content" %>
          Content
        <% end %>
      HTML
    end

    test "content_tag with content as argument and attributes" do
      assert_parsed_snapshot(<<~HTML)
        <%= content_tag :div, "Content", class: "example" %>
      HTML
    end

    test "content_tag with data attributes in hash style" do
      assert_parsed_snapshot(<<~HTML)
        <%= content_tag :div, data: { controller: "example", user_id: 123 } do %>
          Content
        <% end %>
      HTML
    end

    test "content_tag with attributes in string key hash style" do
      assert_parsed_snapshot(<<~HTML)
        <%= content_tag :div, "data-controller" => "example", "data-user-id": 123 do %>
          Content
        <% end %>
      HTML
    end

    test "content_tag with data attributes in underscore style" do
      assert_parsed_snapshot(<<~HTML)
        <%= content_tag :div, data_controller_name: "example", data_user_id: 123 do %>
          Content
        <% end %>
      HTML
    end

    test "content_tag with data attributes in string key hash style" do
      assert_parsed_snapshot(<<~HTML)
        <%= content_tag :div, "Content", data: { "controller-name" => "example", "user-id" => 123 } do %>
          Content
        <% end %>
      HTML
    end

    test "content_tag with variable tag name" do
      assert_parsed_snapshot(<<~HTML)
        <%= content_tag tag_name %>
          Content
        <% end %>
      HTML
    end

    test "content_tag with variable attribute value" do
      assert_parsed_snapshot(<<~HTML)
        <%= content_tag :div, class: class_name %>
          Content
        <% end %>
      HTML
    end

    test "content_tag with attributes splat" do
      assert_parsed_snapshot(<<~HTML)
        <%= content_tag :div, class: "content", **attributes %>
          Content
        <% end %>
      HTML
    end
  end
end
