# frozen_string_literal: true

require_relative "action_view_test_helper"

module Engine
  module ActionView
    class TagAttributesTest < Minitest::Spec
      include ActionViewTestHelper

      test "tag.attributes with class array and dynamic id" do
        assert_optimized_snapshot(
          '<div data-controller="one" <%= tag.attributes(class: ["one", "two", name], id: dom_id) %>>Content</div>',
          { name: "three", dom_id: "post_1" }
        )
      end

      test "tag.attributes with simple attributes" do
        assert_optimized_snapshot(
          '<input <%= tag.attributes(type: :text, aria: { label: "Search" }) %>>'
        )
      end

      test "tag.attributes with attributes before and after" do
        assert_optimized_snapshot(
          '<button class="primary" <%= tag.attributes(id: "cta", disabled: false) %> data-action="click->submit">Go</button>'
        )
      end

      # TODO: Rails HTML-escapes `>` in attribute values to `&gt;`, we don't
      test "tag.attributes with data hash containing special characters" do
        assert_optimized_mismatch_snapshot(
          '<div <%= tag.attributes(data: { controller: "hello", action: "click->hello#greet" }) %>></div>'
        )
      end

      test "tag.attributes with multiline HTML and dynamic values" do
        template = <<~ERB
          <div
            data-controller="one"
            <%= tag.attributes(class: ["one", "two", "three"], id: dom_id) %>
          >
            Content
          </div>
        ERB

        assert_optimized_snapshot(template, { dom_id: "post_1" })
      end

      test "tag.attributes with dynamic boolean attribute" do
        assert_optimized_snapshot(
          "<option <%= tag.attributes(selected: option == current) %>>One</option>",
          { option: "one", current: "two" }
        )
      end

      test "tag.attributes omits an attribute whose value is nil" do
        assert_optimized_snapshot(
          '<html <%= tag.attributes("data-theme": theme) %>></html>',
          { theme: nil }
        )
      end

      test "tag.attributes keeps an attribute whose dynamic value is present" do
        assert_optimized_snapshot(
          '<html <%= tag.attributes("data-theme": theme) %>></html>',
          { theme: "dark" }
        )
      end

      test "tag.attributes flattens a dynamic data hash" do
        assert_optimized_snapshot(
          "<table <%= tag.attributes(data: table_data) %>></table>",
          { table_data: { people_list: "responsive" } }
        )
      end

      test "tag.attributes omits a nil value inside a nested data hash" do
        assert_optimized_snapshot(
          '<table <%= tag.attributes(data: { sortable: "true", people_list: layout }) %>></table>',
          { layout: nil }
        )
      end

      test "tag.attributes tokenizes a dynamic aria array" do
        assert_optimized_snapshot(
          "<div <%= tag.attributes(aria: { describedby: ids }) %>></div>",
          { ids: ["hint", "error"] }
        )
      end

      test "tag.attributes omits a literal nil" do
        assert_optimized_snapshot(
          '<div <%= tag.attributes(id: nil, class: "card") %>></div>'
        )
      end

      test "tag.attributes renders false for an attribute that is not boolean" do
        assert_optimized_snapshot(
          '<details <%= tag.attributes("data-open": open) %>></details>',
          { open: false }
        )
      end

      test "tag.attributes joins a dynamic array value" do
        assert_optimized_snapshot(
          "<a <%= tag.attributes(rel: rels) %>>x</a>",
          { rels: ["noopener", "noreferrer"] }
        )
      end

      test "tag.attributes keeps literal attributes beside a hash built at render time" do
        assert_optimized_snapshot(
          '<table <%= tag.attributes(id: "people", data: table_data) %>></table>',
          { table_data: { people_list: "responsive" } }
        )
      end

      test "tag.attributes keeps literal attributes beside an empty hash built at render time" do
        assert_optimized_snapshot(
          '<table <%= tag.attributes(id: "people", data: table_data) %>></table>',
          { table_data: {} }
        )
      end

      test "tag.attributes keeps a splat" do
        assert_optimized_snapshot(
          '<div <%= tag.attributes(id: "x", **options) %>></div>',
          { options: { title: "Title" } }
        )
      end

      test "tag.attributes does not reuse a local the template already has" do
        assert_optimized_snapshot(
          "<p <%= tag.attributes(title: _herb_attribute_value) %>></p>",
          { _herb_attribute_value: "Title" }
        )
      end

      test "tag.attributes builds a dynamic class list the way Action View does" do
        assert_optimized_snapshot(
          "<div <%= tag.attributes(class: classes) %>></div>",
          { classes: ["card", nil, "", { active: true, hidden: false }] }
        )
      end
    end
  end
end
