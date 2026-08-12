# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::AssetTagHelper
  class StylesheetLinkTagTest < Minitest::Spec
    include SnapshotUtils

    test "stylesheet_link_tag with source" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= stylesheet_link_tag "style" %>
      HTML
    end

    test "stylesheet_link_tag with source including extension" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= stylesheet_link_tag "style.css" %>
      HTML
    end

    test "stylesheet_link_tag with URL" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= stylesheet_link_tag "http://www.example.com/style.css" %>
      HTML
    end

    test "stylesheet_link_tag with extname false, skip_pipeline and rel" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= stylesheet_link_tag "style.less", extname: false, skip_pipeline: true, rel: "stylesheet/less" %>
      HTML
    end

    test "stylesheet_link_tag with media all" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= stylesheet_link_tag "style", media: "all" %>
      HTML
    end

    test "stylesheet_link_tag with media print" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= stylesheet_link_tag "style", media: "print" %>
      HTML
    end

    test "stylesheet_link_tag with multiple sources" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= stylesheet_link_tag "random.styles", "/css/stylish" %>
      HTML
    end

    test "stylesheet_link_tag with protocol-relative URL" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= stylesheet_link_tag "//cdn.example.com/style.css" %>
      HTML
    end

    test "stylesheet_link_tag with host and protocol" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= stylesheet_link_tag "style", host: "localhost", protocol: "https" %>
      HTML
    end

    test "stylesheet_link_tag with skip_pipeline" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= stylesheet_link_tag "application", skip_pipeline: true %>
      HTML
    end

    test "stylesheet_link_tag with rel" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= stylesheet_link_tag "application", rel: "preload" %>
      HTML
    end

    test "stylesheet_link_tag with nonce true" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= stylesheet_link_tag "application", nonce: true %>
      HTML
    end

    test "stylesheet_link_tag with nonce false" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= stylesheet_link_tag "application", nonce: false %>
      HTML
    end

    test "stylesheet_link_tag with interpolated nonce" do
      assert_parsed_snapshot(<<~'HTML', action_view_helpers: true)
        <%= stylesheet_link_tag "application", nonce: "static-#{dynamic}" %>
      HTML
    end

    test "stylesheet_link_tag with data attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= stylesheet_link_tag "application", data: { turbo_track: "reload" } %>
      HTML
    end

    test "stylesheet_link_tag with asset_path" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= stylesheet_link_tag asset_path("application.css") %>
      HTML
    end

    test "stylesheet_link_tag with variable source" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= stylesheet_link_tag stylesheet %>
      HTML
    end

    test "stylesheet_link_tag with multiple sources and media" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= stylesheet_link_tag "application", "admin", media: "all" %>
      HTML
    end
  end
end
