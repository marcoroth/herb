# frozen_string_literal: true

require_relative "../../test_helper"

module Analyze::Rails
  class TagHelperTest < Minitest::Spec
    include SnapshotUtils

    before do
      skip
    end

    test "tag.div with block" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with content as argument" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div "Content" %>
      HTML
    end

    test "tag.div with attributes" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div class: "content" %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with content as argument and attributes" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div "Content", class: "content" %>
      HTML
    end

    test "tag.div with data attributes in hash style" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div data: { controller: "content", user_id: 123 } do %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with attributes in string key hash style" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div, "data-controller" => "example", "data-user-id": 123 do %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with data attributes in underscore style" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div data_controller_name: "content", data_user_id: 123 do %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with data attributes in string key hash style" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div, data: { "controller-name" => "example", "user-id" => 123 } do %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with variable attribute value" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div class: class_name do %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with attributes splat" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div class: "content", **attributes do %>
          Content
        <% end %>
      HTML
    end
  end
end
