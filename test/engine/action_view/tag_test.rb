# frozen_string_literal: true

require_relative "action_view_test_helper"
require_relative "../../snapshot_utils"

module Engine
  module ActionView
    class TagTest < Minitest::Spec
      include ActionViewTestHelper
      include SnapshotUtils

      test "tag.div with block" do
        assert_action_view_helper(<<~ERB)
          <%= tag.div do %>
            Content
          <% end %>
        ERB
      end

      test "tag.div with content as argument" do
        assert_action_view_helper('<%= tag.div "Content" %>')
      end

      test "tag.div with attributes" do
        assert_action_view_helper(<<~ERB)
          <%= tag.div class: "content" do %>
            Content
          <% end %>
        ERB
      end

      test "tag.div with content and attributes" do
        assert_action_view_helper('<%= tag.div "Content", class: "content" %>')
      end

      test "tag.div with data attributes" do
        assert_action_view_helper('<%= tag.div data: { controller: "content" } %>')
      end

      test "tag.br void element" do
        assert_action_view_helper("<%= tag.br %>")
      end

      test "tag.img with attributes" do
        assert_action_view_helper('<%= tag.img src: "image.png", alt: "Photo" %>')
      end

      # TODO: Rails renders `disabled="disabled"` — we render `disabled` (boolean attribute without value).
      # Both are valid HTML, but we could match Rails by rendering `disabled="disabled"` for `true` values.
      test "tag.input with boolean attribute" do
        assert_action_view_helper_mismatch('<%= tag.input type: "text", disabled: true %>')
      end

      test "tag.div with symbol id" do
        assert_action_view_helper('<%= tag.div id: :main %>')
      end

      test "tag.div with aria hash" do
        assert_action_view_helper('<%= tag.div aria: { label: "hello", hidden: true } %>')
      end

      test "tag.section with array class" do
        assert_action_view_helper('<%= tag.section class: ["kitties", "puppies"] %>')
      end

      test "tag.section with %w() class" do
        assert_action_view_helper('<%= tag.section class: %w( kitties puppies ) %>')
      end

      test "tag.div with integer data attribute" do
        assert_action_view_helper('<%= tag.div data: { count: 42 } %>')
      end

      test "tag.div with string style" do
        assert_action_view_helper('<%= tag.div style: "color: red" %>')
      end

      test "tag.p with content" do
        assert_action_view_helper('<%= tag.p "Hello" %>')
      end

      test "tag.div with escape false" do
        assert_action_view_helper('<%= tag.img src: "open & shut.png", escape: false %>')
      end
    end
  end
end
