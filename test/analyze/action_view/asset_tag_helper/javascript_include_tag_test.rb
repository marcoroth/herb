# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::AssetTagHelper
  class JavaScriptIncludeTagTest < Minitest::Spec
    include SnapshotUtils

    test "javascript_include_tag with single source" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_include_tag "application" %>
      HTML
    end

    test "javascript_include_tag with multiple sources" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_include_tag "application", "vendor" %>
      HTML
    end

    test "javascript_include_tag with defer" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_include_tag "application", defer: true %>
      HTML
    end

    test "javascript_include_tag with nonce true" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_include_tag "application", nonce: true %>
      HTML
    end

    test "javascript_include_tag with data attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_include_tag "application", data: { turbo_track: "reload" } %>
      HTML
    end

    test "javascript_include_tag with asset_path" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_include_tag asset_path("application.js") %>
      HTML
    end

    test "javascript_include_tag with URL" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_include_tag "http://www.example.com/xmlhr" %>
      HTML
    end

    test "javascript_include_tag with protocol-relative URL" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_include_tag "//cdn.example.com/app.js" %>
      HTML
    end

    test "javascript_include_tag with host and protocol" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_include_tag "xmlhr", host: "localhost", protocol: "https" %>
      HTML
    end

    test "javascript_include_tag with URL ending in .js" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_include_tag "http://www.example.com/xmlhr.js" %>
      HTML
    end

    test "javascript_include_tag with URL and nonce" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_include_tag "http://www.example.com/xmlhr.js", nonce: true %>
      HTML
    end

    test "javascript_include_tag with URL and async" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_include_tag "http://www.example.com/xmlhr.js", async: true %>
      HTML
    end

    test "javascript_include_tag with URL and defer" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_include_tag "http://www.example.com/xmlhr.js", defer: true %>
      HTML
    end

    test "javascript_include_tag with extname false" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_include_tag "template.jst", extname: false %>
      HTML
    end

    test "javascript_include_tag with .js extension" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_include_tag "xmlhr.js" %>
      HTML
    end

    test "javascript_include_tag with multiple sources including path" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_include_tag "common.javascript", "/elsewhere/cools" %>
      HTML
    end

    test "javascript_include_tag with defer as string" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_include_tag "application", defer: "true" %>
      HTML
    end

    test "javascript_include_tag with interpolated nonce" do
      assert_parsed_snapshot(<<~'HTML', action_view_helpers: true)
        <%= javascript_include_tag "application", nonce: "static-#{dynamic}" %>
      HTML
    end

    test "javascript_include_tag with nonce false" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_include_tag "application", nonce: false %>
      HTML
    end

    test "javascript_include_tag with skip_pipeline" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_include_tag "application", skip_pipeline: true %>
      HTML
    end
  end
end
