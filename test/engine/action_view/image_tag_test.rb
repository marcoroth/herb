# frozen_string_literal: true

require_relative "action_view_test_helper"

module Engine
  module ActionView
    class ImageTagTest < Minitest::Spec
      include ActionViewTestHelper

      test "image_tag with string source" do
        assert_action_view_helper('<%= image_tag "icon.png" %>')
      end

      test "image_tag with alt attribute" do
        assert_action_view_helper('<%= image_tag "icon.png", alt: "Icon" %>')
      end

      test "image_tag with multiple attributes" do
        assert_action_view_helper('<%= image_tag "photo.jpg", alt: "Photo", class: "avatar" %>')
      end

      test "image_tag with URL source" do
        assert_action_view_helper('<%= image_tag "http://example.com/icon.png" %>')
      end
    end
  end
end
