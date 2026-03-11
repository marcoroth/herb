# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::TagHelper
  class TurboFrameTagTest < Minitest::Spec
    include SnapshotUtils

    test "turbo_frame_tag with block" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= turbo_frame_tag "tray" do %>
          Content
        <% end %>
      HTML
    end

    test "turbo_frame_tag with string id" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= turbo_frame_tag "tray" %>
      HTML
    end

    test "turbo_frame_tag with src attribute" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= turbo_frame_tag "tray", src: tray_path(tray) %>
      HTML
    end

    test "turbo_frame_tag with src and target attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= turbo_frame_tag "tray", src: tray_path(tray), target: "_top" %>
      HTML
    end

    test "turbo_frame_tag with loading lazy" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= turbo_frame_tag "tray", src: tray_path(tray), loading: "lazy" %>
      HTML
    end

    test "turbo_frame_tag with target attribute" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= turbo_frame_tag "tray", target: "other_tray" %>
      HTML
    end

    test "turbo_frame_tag with class attribute" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= turbo_frame_tag "tray", class: "frame" do %>
          Content
        <% end %>
      HTML
    end

    test "turbo_frame_tag with data attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= turbo_frame_tag "tray", data: { controller: "frame", action: "click->frame#load" } do %>
          Content
        <% end %>
      HTML
    end

    test "turbo_frame_tag with variable id" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= turbo_frame_tag dom_id(post) do %>
          Content
        <% end %>
      HTML
    end

    test "turbo_frame_tag with attributes splat" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= turbo_frame_tag "tray", **attributes do %>
          Content
        <% end %>
      HTML
    end
  end
end
