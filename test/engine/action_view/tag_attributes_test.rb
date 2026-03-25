# frozen_string_literal: true

require_relative "action_view_test_helper"

module Engine
  module ActionView
    class TagAttributesTest < Minitest::Spec
      include ActionViewTestHelper

      test "tag.attributes with class array and dynamic id" do
        assert_precompiled_snapshot(
          '<div data-controller="one" <%= tag.attributes(class: ["one", "two", name], id: dom_id) %>>Content</div>',
          { name: "three", dom_id: "post_1" }
        )
      end

      test "tag.attributes with simple attributes" do
        assert_precompiled_snapshot(
          '<input <%= tag.attributes(type: :text, aria: { label: "Search" }) %>>',
        )
      end

      test "tag.attributes with attributes before and after" do
        assert_precompiled_snapshot(
          '<button class="primary" <%= tag.attributes(id: "cta", disabled: false) %> data-action="click->submit">Go</button>',
        )
      end

      # TODO: Rails HTML-escapes `>` in attribute values to `&gt;`, we don't
      test "tag.attributes with data hash containing special characters" do
        assert_precompiled_mismatch_snapshot(
          '<div <%= tag.attributes(data: { controller: "hello", action: "click->hello#greet" }) %>></div>',
        )
      end

      # TODO: Whitespace difference — Herb strips leading indentation on attributes
      test "tag.attributes with multiline HTML and dynamic values" do
        template = <<~ERB
          <div
            data-controller="one"
            <%= tag.attributes(class: ["one", "two", "three"], id: dom_id) %>
          >
            Content
          </div>
        ERB

        assert_precompiled_mismatch_snapshot(template, { dom_id: "post_1" })
      end
    end
  end
end
