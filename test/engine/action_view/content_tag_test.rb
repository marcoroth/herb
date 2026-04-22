# frozen_string_literal: true

require_relative "action_view_test_helper"

module Engine
  module ActionView
    class ContentTagTest < Minitest::Spec
      include ActionViewTestHelper

      test "content_tag with block" do
        assert_optimized_snapshot(<<~ERB)
          <%= content_tag :div do %>
            Content
          <% end %>
        ERB
      end

      test "content_tag with content argument" do
        assert_optimized_snapshot('<%= content_tag :div, "Content" %>')
      end

      test "content_tag with content and attributes" do
        assert_optimized_snapshot('<%= content_tag :div, "Content", class: "example" %>')
      end

      test "content_tag with data attributes" do
        assert_optimized_snapshot('<%= content_tag :div, data: { controller: "example" } do %>Content<% end %>')
      end

      # TODO: Rails renders `<br></br>` (content_tag doesn't know about void elements).
      # We render `<br>` because we set is_void: true. Our output is more correct HTML.
      test "content_tag br void element" do
        assert_optimized_mismatch_snapshot("<%= content_tag :br %>")
      end

      test "content_tag with inline block" do
        assert_optimized_snapshot('<%= content_tag(:details) { "Some content" } %>')
      end

      test "content_tag with inline block and attributes" do
        assert_optimized_snapshot('<%= content_tag(:div, class: "container") { "Hello" } %>')
      end

      test "content_tag with inline block and ruby expression" do
        assert_optimized_snapshot(
          "<%= content_tag(:p) { @user_name } %>",
          { "@user_name": "Alice" }
        )
      end

      test "content_tag :script with nonce true" do
        assert_optimized_snapshot('<%= content_tag(:script, "alert(1)", nonce: true) %>')
      end

      test "content_tag :script with nonce false" do
        assert_optimized_snapshot('<%= content_tag(:script, "alert(1)", nonce: false) %>')
      end
    end
  end
end
