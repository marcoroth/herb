# frozen_string_literal: true

require_relative "action_view_test_helper"

module Engine
  module ActionView
    class JavascriptIncludeTagTest < Minitest::Spec
      include ActionViewTestHelper

      test "javascript_include_tag with single source" do
        assert_optimized_snapshot('<%= javascript_include_tag "application" %>')
      end

      # TODO: Boolean attribute style (defer vs defer="defer")
      test "javascript_include_tag with defer" do
        assert_optimized_mismatch_snapshot('<%= javascript_include_tag "application", defer: true %>')
      end

      test "javascript_include_tag with URL" do
        assert_optimized_snapshot('<%= javascript_include_tag "http://www.example.com/xmlhr.js" %>')
      end

      # TODO: Boolean attribute style (async vs async="async")
      test "javascript_include_tag with URL and async" do
        assert_optimized_mismatch_snapshot('<%= javascript_include_tag "http://www.example.com/xmlhr.js", async: true %>')
      end

      test "javascript_include_tag with data attributes" do
        assert_optimized_snapshot('<%= javascript_include_tag "application", data: { turbo_track: "reload" } %>')
      end

      test "javascript_include_tag with duplicate sources" do
        assert_optimized_snapshot('<%= javascript_include_tag "application", "application" %>')
      end

      test "javascript_include_tag with duplicate sources among distinct ones" do
        assert_optimized_snapshot('<%= javascript_include_tag "application", "vendor", "application" %>')
      end

      test "javascript_include_tag with crossorigin true" do
        assert_optimized_snapshot('<%= javascript_include_tag "application", crossorigin: true %>')
      end

      test "javascript_include_tag with crossorigin string" do
        assert_optimized_snapshot('<%= javascript_include_tag "application", crossorigin: "use-credentials" %>')
      end

      test "javascript_include_tag with nopush" do
        assert_optimized_snapshot('<%= javascript_include_tag "application", nopush: true %>')
      end

      test "javascript_include_tag with preload_links_header" do
        assert_optimized_snapshot('<%= javascript_include_tag "application", preload_links_header: false %>')
      end

      test "javascript_include_tag with integrity" do
        assert_optimized_snapshot('<%= javascript_include_tag "application", integrity: "sha256-abc" %>')
      end
    end
  end
end
