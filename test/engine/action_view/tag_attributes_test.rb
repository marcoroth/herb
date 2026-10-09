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

      test "attribute splats survive helper lowering" do
        attrs = { id: "root", class: "primary", role: "button", data: { controller: "hello" } }

        [
          "<%= tag.div(**attrs) do %>x<% end %>",
          "<%= tag.div(**attrs) %>",
          "<%= tag.input(**attrs) %>",
          '<%= content_tag(:div, "x", **attrs) %>',
          "<div <%= tag.attributes(**attrs) %>>x</div>"
        ].each do |template|
          assert_optimized_output_match(template, { attrs: attrs })
        end
      end

      test "attribute splats preserve surrounding attributes and Rails escaping" do
        assert_optimized_output_match(
          '<%= tag.div(class: "primary", **attrs) do %>x<% end %>',
          { attrs: { title: '"<&>', aria: { label: "Search" }, hidden: true } }
        )
        assert_optimized_output_match(
          '<div id="root" <%= tag.attributes(**attrs) %> role="button">x</div>',
          { attrs: { title: '"<&>', hidden: false } }
        )
      end

      test "empty attribute splats do not add whitespace" do
        assert_optimized_output_match("<%= tag.div(**attrs) %>", { attrs: {} })
        assert_optimized_output_match('<%= tag.div(id: "root", **attrs) %>', { attrs: {} })
      end

      test "attribute splats compile without a visitor in both escape modes" do
        template = "<%= tag.div(**attrs) %>"
        locals = { attrs: { title: '"<&>', disabled: true } }

        [false, true].each do |escape|
          engine = Herb::Engine.new(template, escape: escape, parser_options: { action_view_helpers: true })

          assert_equal render_with_action_view(template, locals), action_view_eval(engine.src, locals)
        end
      end

      test "nested data and aria splats retain their prefixes" do
        assert_optimized_output_match(
          "<%= tag.div(data: { **data_attrs }, aria: { **aria_attrs }) %>",
          { data_attrs: { controller: "hello" }, aria_attrs: { label: "Search" } }
        )
      end
    end
  end
end
