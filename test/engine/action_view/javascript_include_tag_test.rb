# frozen_string_literal: true

require_relative "action_view_test_helper"

module Engine
  module ActionView
    class JavascriptIncludeTagTest < Minitest::Spec
      include ActionViewTestHelper

      test "javascript_include_tag with single source" do
        assert_action_view_helper('<%= javascript_include_tag "application" %>')
      end

      test "javascript_include_tag with defer" do
        assert_action_view_helper('<%= javascript_include_tag "application", defer: true %>')
      end

      test "javascript_include_tag with URL" do
        assert_action_view_helper('<%= javascript_include_tag "http://www.example.com/xmlhr.js" %>')
      end
    end
  end
end
