# frozen_string_literal: true

require_relative "action_view_test_helper"

module Engine
  module ActionView
    class ImageTagTest < Minitest::Spec
      include ActionViewTestHelper

      test "image_tag with string source" do
        assert_precompiled_snapshot('<%= image_tag "icon.png" %>')
      end

      test "image_tag with alt attribute" do
        assert_precompiled_snapshot('<%= image_tag "icon.png", alt: "Icon" %>')
      end

      test "image_tag with multiple attributes" do
        assert_precompiled_snapshot('<%= image_tag "photo.jpg", alt: "Photo", class: "avatar" %>')
      end

      test "image_tag with URL source" do
        assert_precompiled_snapshot('<%= image_tag "http://example.com/icon.png" %>')
      end

      test "image_tag with protocol-relative URL" do
        assert_precompiled_snapshot('<%= image_tag "//cdn.example.com/icon.png" %>')
      end

      test "image_tag with ruby expression source" do
        assert_precompiled_snapshot(
          "<%= image_tag user_avatar %>",
          { user_avatar: "http://example.com/avatar.png" }
        )
      end

      test "image_tag with data attributes" do
        assert_precompiled_snapshot('<%= image_tag "icon.png", data: { controller: "image" } %>')
      end
    end
  end
end
