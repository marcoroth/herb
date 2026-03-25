# frozen_string_literal: true

require_relative "action_view_test_helper"

module Engine
  module ActionView
    class JavascriptIncludeTagTest < Minitest::Spec
      include ActionViewTestHelper

      test "javascript_include_tag with single source" do
        assert_precompiled_snapshot('<%= javascript_include_tag "application" %>')
      end

      # TODO: Attribute ordering (defer before src) and boolean attribute style (defer vs defer="defer")
      test "javascript_include_tag with defer" do
        assert_precompiled_mismatch_snapshot('<%= javascript_include_tag "application", defer: true %>')
      end

      test "javascript_include_tag with URL" do
        assert_precompiled_snapshot('<%= javascript_include_tag "http://www.example.com/xmlhr.js" %>')
      end

      # TODO: Boolean attribute style (async vs async="async") and attribute ordering
      test "javascript_include_tag with URL and async" do
        assert_precompiled_mismatch_snapshot('<%= javascript_include_tag "http://www.example.com/xmlhr.js", async: true %>')
      end

      # TODO: Attribute ordering (data-turbo-track before src vs after)
      test "javascript_include_tag with data attributes" do
        assert_precompiled_mismatch_snapshot('<%= javascript_include_tag "application", data: { turbo_track: "reload" } %>')
      end
    end
  end
end
