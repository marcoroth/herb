# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::AssetTagHelper
  class ImageTagTest < Minitest::Spec
    include SnapshotUtils

    test "image_tag" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= image_tag "example.jpg" %>
      HTML
    end

    test "image_tag with alt" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= image_tag "example.jpg", alt: "Example" %>
      HTML
    end

    test "image_tag with asset_path" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= image_tag asset_path("example.jpg") %>
      HTML
    end

    test "image_tag with asset_url" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= image_tag asset_url("example.jpg") %>
      HTML
    end

    test "image_tag with data attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= image_tag "example.jpg", data: { controller: "example", user_id: 123 } %>
      HTML
    end

    test "image_tag with skip_pipeline" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= image_tag "icon.png", skip_pipeline: true %>
      HTML
    end

    test "image_tag with static size WxH" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= image_tag "icon.png", size: "32x32" %>
      HTML
    end

    test "image_tag with static size N" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= image_tag "icon.png", size: "32" %>
      HTML
    end

    test "image_tag with dynamic size" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= image_tag "icon.png", size: some_var %>
      HTML
    end

    test "image_tag with size and other attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= image_tag "icon.png", size: "32x32", alt: "Icon", class: "avatar" %>
      HTML
    end
  end
end
