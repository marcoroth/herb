# frozen_string_literal: true

require_relative "action_view_test_helper"
require_relative "../../snapshot_utils"

module Engine
  module ActionView
    class ContentTagTest < Minitest::Spec
      include ActionViewTestHelper
      include SnapshotUtils

      test "content_tag with block" do
        assert_action_view_helper(<<~ERB)
          <%= content_tag :div do %>
            Content
          <% end %>
        ERB
      end

      test "content_tag with content argument" do
        assert_action_view_helper('<%= content_tag :div, "Content" %>')
      end

      test "content_tag with content and attributes" do
        assert_action_view_helper('<%= content_tag :div, "Content", class: "example" %>')
      end

      test "content_tag with data attributes" do
        assert_action_view_helper('<%= content_tag :div, data: { controller: "example" } do %>Content<% end %>')
      end

      # TODO: Rails renders `<br></br>` (content_tag doesn't know about void elements).
      # We render `<br>` because we set is_void: true. Our output is more correct HTML.
      test "content_tag br void element" do
        assert_action_view_helper_mismatch('<%= content_tag :br %>')
      end
    end
  end
end
