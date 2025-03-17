# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::AssetTagHelper
  class ImageTagTest < Minitest::Spec
    include SnapshotUtils

    before do
      skip
    end

    test "image_tag" do
      assert_parsed_snapshot(<<~HTML)
        <%= image_tag "example.jpg" %>
      HTML
    end

    test "image_tag with alt" do
      assert_parsed_snapshot(<<~HTML)
        <%= image_tag "example.jpg", alt: "Example" %>
      HTML
    end

    test "image_tag with asset_path" do
      assert_parsed_snapshot(<<~HTML)
        <%= image_tag asset_path("example.jpg") %>
      HTML
    end

    test "image_tag with asset_url" do
      assert_parsed_snapshot(<<~HTML)
        <%= image_tag asset_url("example.jpg") %>
      HTML
    end

    test "image_tag with data attributes" do
      assert_parsed_snapshot(<<~HTML)
        <%= image_tag "example.jpg", data: { controller: "example", user_id: 123 } %>
      HTML
    end
  end
end
