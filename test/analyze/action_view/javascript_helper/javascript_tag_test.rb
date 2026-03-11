# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::JavaScriptHelper
  class JavaScriptTagTest < Minitest::Spec
    include SnapshotUtils

    test "javascript_tag with block" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_tag do %>
          alert('Hello')
        <% end %>
      HTML
    end

    test "javascript_tag with content as argument" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_tag "alert('Hello')" %>
      HTML
    end

    test "javascript_tag with html_options" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_tag "alert('Hello')", type: "application/javascript" %>
      HTML
    end

    test "javascript_tag with nonce" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_tag nonce: true do %>
          alert('Hello')
        <% end %>
      HTML
    end

    test "javascript_tag with data attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_tag data: { turbo_eval: false } do %>
          console.log('Hello')
        <% end %>
      HTML
    end

    test "javascript_tag with variable content" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_tag js_content %>
      HTML
    end

    test "javascript_tag with URL in comment (gh-991)" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <% javascript_tag do %>
          // <http://example.com>
        <% end %>
      HTML
    end
  end
end
