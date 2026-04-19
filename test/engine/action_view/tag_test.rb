# frozen_string_literal: true

require_relative "action_view_test_helper"

module Engine
  module ActionView
    class TagTest < Minitest::Spec
      include ActionViewTestHelper

      test "tag.div with block" do
        assert_optimized_snapshot(<<~ERB)
          <%= tag.div do %>
            Content
          <% end %>
        ERB
      end

      test "tag.div with content as argument" do
        assert_optimized_snapshot('<%= tag.div "Content" %>')
      end

      test "tag.div with attributes" do
        assert_optimized_snapshot(<<~ERB)
          <%= tag.div class: "content" do %>
            Content
          <% end %>
        ERB
      end

      test "tag.div with content and attributes" do
        assert_optimized_snapshot('<%= tag.div "Content", class: "content" %>')
      end

      test "tag.div with data attributes in hash style" do
        assert_optimized_snapshot('<%= tag.div data: { controller: "content" } %>')
      end

      test "tag.br void element" do
        assert_optimized_snapshot("<%= tag.br %>")
      end

      test "tag.img with attributes" do
        assert_optimized_snapshot('<%= tag.img src: "image.png", alt: "Photo" %>')
      end

      # TODO: Rails renders `disabled="disabled"` — we render `disabled` (boolean attribute without value).
      test "tag.input with boolean attribute" do
        assert_optimized_mismatch_snapshot('<%= tag.input type: "text", disabled: true %>')
      end

      test "tag.div with symbol id" do
        assert_optimized_snapshot("<%= tag.div id: :main %>")
      end

      test "tag.div with aria hash" do
        assert_optimized_snapshot('<%= tag.div aria: { label: "hello", hidden: true } %>')
      end

      test "tag.section with array class" do
        assert_optimized_snapshot('<%= tag.section class: ["kitties", "puppies"] %>')
      end

      test "tag.section with %w() class" do
        assert_optimized_snapshot("<%= tag.section class: %w( kitties puppies ) %>")
      end

      test "tag.div with integer data attribute" do
        assert_optimized_snapshot("<%= tag.div data: { count: 42 } %>")
      end

      test "tag.div with string style" do
        assert_optimized_snapshot('<%= tag.div style: "color: red" %>')
      end

      test "tag.p with content" do
        assert_optimized_snapshot('<%= tag.p "Hello" %>')
      end

      test "tag.div with escape false" do
        assert_optimized_snapshot('<%= tag.img src: "open & shut.png", escape: false %>')
      end

      test "tag.details with inline block" do
        assert_optimized_snapshot('<%= tag.details { "Some content" } %>')
      end

      test "tag.div with inline block and attributes" do
        assert_optimized_snapshot('<%= tag.div(class: "container") { "Hello" } %>')
      end

      test "tag.p with inline block and ruby expression" do
        assert_optimized_snapshot(
          "<%= tag.p { @user_name } %>",
          { "@user_name": "Alice" }
        )
      end

      test "tag.script with nonce true" do
        assert_optimized_snapshot('<%= tag.script(nonce: true) { "alert(1)".html_safe } %>')
      end

      test "tag.script with nonce false" do
        assert_optimized_snapshot('<%= tag.script(nonce: false) { "alert(1)".html_safe } %>')
      end

      test "nested tag helpers are also converted" do
        assert_optimized_snapshot(<<~ERB)
          <%= tag.div class: "outer" do %>
            <%= tag.span "Inner" %>
          <% end %>
        ERB
      end

      test "tag.div with multiple attributes" do
        assert_optimized_snapshot(<<~ERB)
          <%= tag.div class: "content", id: "main" do %>
            Content
          <% end %>
        ERB
      end

      test "tag.div with variable attribute value" do
        assert_optimized_snapshot(
          "<%= tag.div class: class_name do %>Content<% end %>",
          { class_name: "dynamic-class" }
        )
      end

      test "tag.div with data attribute ruby literal value" do
        assert_optimized_snapshot('<%= tag.div data: { controller: "content", user_id: 123 } do %>Content<% end %>')
      end

      test "tag.hr void element with attributes" do
        assert_optimized_snapshot('<%= tag.hr class: "divider" %>')
      end

      test "tag.div with dynamic string data attribute value" do
        assert_optimized_snapshot(
          "<%= tag.div data: { controller: controller_name } %>",
          { controller_name: "navigation" }
        )
      end

      test "tag.div with dynamic symbol data attribute value" do
        assert_optimized_snapshot(
          "<%= tag.div data: { controller: controller_name } %>",
          { controller_name: :navigation }
        )
      end

      test "tag.div with dynamic integer data attribute value" do
        assert_optimized_snapshot(
          "<%= tag.div data: { count: item_count } %>",
          { item_count: 42 }
        )
      end

      test "tag.div with dynamic boolean data attribute value" do
        assert_optimized_snapshot(
          "<%= tag.div data: { loading: is_loading } %>",
          { is_loading: true }
        )
      end

      test "tag.div with dynamic hash data attribute value" do
        assert_optimized_snapshot(
          "<%= tag.div data: { config: options } %>",
          { options: { nested: true, count: 3 } }
        )
      end

      # TODO: Rails escapes string content arguments (e.g. & → &amp;), but precompile inlines them as raw HTML.
      test "tag.p with HTML entity in content" do
        assert_optimized_mismatch_snapshot('<%= tag.p "&copy; 2024 Example Corp" %>')
      end

      test "tag.div with script tag in attribute value" do
        assert_optimized_snapshot(
          '<%= tag.div data: { value: user_input } %>',
          { user_input: '<script>alert("xss")</script>' }
        )
      end

      test "tag.div with quotes in attribute value" do
        assert_optimized_snapshot(
          '<%= tag.div title: user_input %>',
          { user_input: 'He said "hello" & goodbye' }
        )
      end

      test "tag.div with angle brackets in attribute value" do
        assert_optimized_snapshot(
          '<%= tag.div title: user_input %>',
          { user_input: "<b>bold</b>" }
        )
      end

      # TODO: Rails omits attributes with nil values entirely — we render class=""
      test "tag.div with nil class" do
        assert_optimized_mismatch_snapshot("<%= tag.div class: nil %>")
      end

      test "tag.div with empty string class" do
        assert_optimized_snapshot('<%= tag.div class: "" %>')
      end

      test "tag.div with false boolean attribute" do
        assert_optimized_snapshot('<%= tag.div disabled: false %>')
      end

      test "optimized block trims trailing whitespace" do
        template = "<%= tag.div do %>\n  Content\n<% end %>\n"

        engine = Herb::Engine.new(template, escape: false, optimize: true)
        result = eval(engine.src) # rubocop:disable Security/Eval

        assert_equal "<div>\n  Content\n</div>", result
        refute result.end_with?("\n"), "Optimized output should not have trailing newline"
      end
    end
  end
end
