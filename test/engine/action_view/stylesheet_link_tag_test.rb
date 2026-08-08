# frozen_string_literal: true

require_relative "action_view_test_helper"

module Engine
  module ActionView
    class StylesheetLinkTagTest < Minitest::Spec
      include ActionViewTestHelper

      test "stylesheet_link_tag with source" do
        assert_optimized_snapshot('<%= stylesheet_link_tag "style" %>')
      end

      test "stylesheet_link_tag with source including extension" do
        assert_optimized_snapshot('<%= stylesheet_link_tag "style.css" %>')
      end

      test "stylesheet_link_tag with URL" do
        assert_optimized_snapshot('<%= stylesheet_link_tag "http://www.example.com/style.css" %>')
      end

      test "stylesheet_link_tag with extname false, skip_pipeline and rel" do
        assert_optimized_snapshot(
          '<%= stylesheet_link_tag "style.less", extname: false, skip_pipeline: true, rel: "stylesheet/less" %>'
        )
      end

      test "stylesheet_link_tag with media all" do
        assert_optimized_snapshot('<%= stylesheet_link_tag "style", media: "all" %>')
      end

      test "stylesheet_link_tag with media print" do
        assert_optimized_snapshot('<%= stylesheet_link_tag "style", media: "print" %>')
      end

      test "stylesheet_link_tag with multiple sources" do
        assert_optimized_snapshot('<%= stylesheet_link_tag "random.styles", "/css/stylish" %>')
      end

      test "stylesheet_link_tag with protocol-relative URL" do
        assert_optimized_snapshot('<%= stylesheet_link_tag "//cdn.example.com/style.css" %>')
      end

      test "stylesheet_link_tag with host and protocol" do
        assert_optimized_snapshot('<%= stylesheet_link_tag "style", host: "localhost", protocol: "https" %>')
      end

      test "stylesheet_link_tag with skip_pipeline" do
        assert_optimized_snapshot('<%= stylesheet_link_tag "application", skip_pipeline: true %>')
      end

      test "stylesheet_link_tag with rel" do
        assert_optimized_snapshot('<%= stylesheet_link_tag "application", rel: "preload" %>')
      end

      test "stylesheet_link_tag with data attributes" do
        assert_optimized_snapshot('<%= stylesheet_link_tag "application", data: { turbo_track: "reload" } %>')
      end

      test "stylesheet_link_tag with multiple sources and media" do
        assert_optimized_snapshot('<%= stylesheet_link_tag "application", "admin", media: "all" %>')
      end

      test "stylesheet_link_tag with duplicate sources" do
        assert_optimized_snapshot('<%= stylesheet_link_tag "application", "application" %>')
      end

      test "stylesheet_link_tag with duplicate sources among distinct ones" do
        assert_optimized_snapshot('<%= stylesheet_link_tag "application", "admin", "application" %>')
      end

      test "stylesheet_link_tag with crossorigin true" do
        assert_optimized_snapshot('<%= stylesheet_link_tag "application", crossorigin: true %>')
      end

      test "stylesheet_link_tag with crossorigin string" do
        assert_optimized_snapshot('<%= stylesheet_link_tag "application", crossorigin: "use-credentials", media: "all" %>')
      end

      test "stylesheet_link_tag with nopush" do
        assert_optimized_snapshot('<%= stylesheet_link_tag "application", nopush: true %>')
      end

      test "stylesheet_link_tag with preload_links_header" do
        assert_optimized_snapshot('<%= stylesheet_link_tag "application", preload_links_header: false %>')
      end

      test "stylesheet_link_tag with integrity" do
        assert_optimized_snapshot('<%= stylesheet_link_tag "application", integrity: "sha256-abc" %>')
      end
    end
  end
end
