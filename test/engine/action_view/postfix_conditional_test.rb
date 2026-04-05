# frozen_string_literal: true

require_relative "action_view_test_helper"

module Engine
  module ActionView
    class PostfixConditionalTest < Minitest::Spec
      include ActionViewTestHelper

      test "tag.div with postfix if condition" do
        assert_precompiled_snapshot(
          '<%= tag.div("visible", class: "notice") if condition %>',
          { condition: true }
        )
      end

      test "tag.div with postfix unless condition" do
        assert_precompiled_snapshot(
          '<%= tag.div("hidden", class: "warning") unless condition %>',
          { condition: false }
        )
      end

      test "link_to with postfix if condition" do
        assert_precompiled_snapshot(
          '<%= link_to "Settings", "/settings" if condition %>',
          { condition: true }
        )
      end

      test "image_tag with postfix if condition" do
        assert_precompiled_snapshot(
          '<%= image_tag "icon.png", alt: "Icon" if condition %>',
          { condition: true }
        )
      end

      test "content_tag with postfix unless condition" do
        assert_precompiled_snapshot(
          '<%= content_tag(:p, "Notice", class: "alert") unless condition %>',
          { condition: false }
        )
      end
    end
  end
end
