# frozen_string_literal: true

require_relative "action_view_test_helper"

module Engine
  module ActionView
    class ImageTagTest < Minitest::Spec
      include ActionViewTestHelper

      Image = Data.define(:id)

      test "image_tag with string source" do
        assert_optimized_snapshot('<%= image_tag "icon.png" %>')
      end

      test "image_tag with alt attribute" do
        assert_optimized_snapshot('<%= image_tag "icon.png", alt: "Icon" %>')
      end

      test "image_tag with multiple attributes" do
        assert_optimized_snapshot('<%= image_tag "photo.jpg", alt: "Photo", class: "avatar" %>')
      end

      test "image_tag with URL source" do
        assert_optimized_snapshot('<%= image_tag "http://example.com/icon.png" %>')
      end

      test "image_tag with protocol-relative URL" do
        assert_optimized_snapshot('<%= image_tag "//cdn.example.com/icon.png" %>')
      end

      test "image_tag with ruby expression source" do
        assert_optimized_snapshot(
          "<%= image_tag user_avatar %>",
          { user_avatar: "http://example.com/avatar.png" }
        )
      end

      test "image_tag with data attributes" do
        assert_optimized_snapshot('<%= image_tag "icon.png", data: { controller: "image" } %>')
      end

      test "image_tag routes a model through polymorphic_url" do
        source = Image.new(7)
        calls = 0
        fetch_source = lambda do
          calls += 1
          source
        end
        routed_sources = []
        context = action_view_context
        context.define_singleton_method(:polymorphic_url) do |record|
          routed_sources << record
          "https://example.com/images/#{record.id}"
        end

        engine = Herb::Engine.new(
          '<%= image_tag fetch_source.call, alt: "Photo" %>',
          escape: false,
          visitors: [Herb::Engine::OptimizeVisitor.new]
        )

        expected = context.image_tag(source, alt: "Photo")
        actual = action_view_eval(engine.src, { fetch_source: fetch_source })

        assert_equal expected, actual
        assert_equal [source, source], routed_sources
        assert_equal 1, calls
      end

      test "image_tag with a symbol source held in a local" do
        assert_optimized_snapshot('<%= image_tag source, skip_pipeline: true %>', { source: :photo })
      end

      test "image_tag evaluates a string source once" do
        calls = 0
        fetch_source = lambda do
          calls += 1
          "photo.png"
        end
        engine = Herb::Engine.new(
          '<%= image_tag fetch_source.call, skip_pipeline: true %>',
          escape: false,
          visitors: [Herb::Engine::OptimizeVisitor.new]
        )

        actual = action_view_eval(engine.src, { fetch_source: fetch_source })

        assert_equal action_view_context.image_tag("photo.png", skip_pipeline: true), actual
        assert_equal 1, calls
      end
    end
  end
end
