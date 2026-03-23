# frozen_string_literal: true

require_relative "action_view_test_helper"

module Engine
  module ActionView
    class TurboFrameTagTest < Minitest::Spec
      include ActionViewTestHelper

      test "turbo_frame_tag with block" do
        assert_action_view_helper(<<~ERB)
          <%= turbo_frame_tag "tray" do %>
            Content
          <% end %>
        ERB
      end

      test "turbo_frame_tag without block" do
        assert_action_view_helper('<%= turbo_frame_tag "tray" %>')
      end

      test "turbo_frame_tag with src" do
        assert_action_view_helper('<%= turbo_frame_tag "tray", src: "/path" %>')
      end

      test "turbo_frame_tag with src and target" do
        assert_action_view_helper('<%= turbo_frame_tag "tray", src: "/path", target: "_top" %>')
      end

      test "turbo_frame_tag with loading lazy" do
        assert_action_view_helper('<%= turbo_frame_tag "tray", src: "/path", loading: "lazy" %>')
      end

      test "turbo_frame_tag with class and block" do
        assert_action_view_helper(<<~ERB)
          <%= turbo_frame_tag "tray", class: "frame" do %>
            Content
          <% end %>
        ERB
      end

      test "turbo_frame_tag with variable id" do
        assert_action_view_helper(
          '<%= turbo_frame_tag dom_id do %>Content<% end %>',
          { dom_id: "post_1" }
        )
      end

      test "turbo_frame_tag with data attributes" do
        assert_action_view_helper('<%= turbo_frame_tag "tray", data: { controller: "frame" } do %>Content<% end %>')
      end
    end
  end
end
