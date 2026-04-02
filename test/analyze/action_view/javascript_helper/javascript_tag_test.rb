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

    test "javascript_tag with nonce true" do
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

    test "javascript_tag with HTML-like content in block (gh-1426)" do
      template = <<~HTML
        <%= javascript_tag do %>
          n <o.length
        <% end %>
      HTML

      assert_parsed_snapshot(template, action_view_helpers: true)
      assert_parsed_snapshot(template)
    end

    test "javascript_tag with embedded ERB in HTML string literal" do
      template = <<~HTML
        <%= javascript_tag do %>
          const html = "<code><%= content %></code>";

          console.log(html)
        <% end %>
      HTML

      assert_parsed_snapshot(template, action_view_helpers: true)
      assert_parsed_snapshot(template)
    end

    test "javascript_tag with less-than operator and space (gh-1426)" do
      template = <<~HTML
        <%= javascript_tag do %>
          n < o.length
        <% end %>
      HTML

      assert_parsed_snapshot(template, action_view_helpers: true)
      assert_parsed_snapshot(template)
    end

    test "javascript_tag with less-than in condition (gh-1426)" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_tag do %>
          if (n<o) console.log("hello")
        <% end %>
      HTML
    end

    test "javascript_tag with less-than in for loop condition (gh-1426)" do
      template = <<~HTML
        <%= javascript_tag do %>
          for (let i = 0; i<items.length; i++) { console.log(items[i]) }
        <% end %>
      HTML

      assert_parsed_snapshot(template, action_view_helpers: true)
      assert_parsed_snapshot(template)
    end

    test "javascript_tag with less-than in arrow function (gh-1426)" do
      template = <<~HTML
        <%= javascript_tag do %>
          const filtered = items.filter(x => x<threshold)
        <% end %>
      HTML

      assert_parsed_snapshot(template, action_view_helpers: true)
      assert_parsed_snapshot(template)
    end

    test "javascript_tag with less-than and nested ERB control flow (gh-1426)" do
      template = <<~HTML
        <%= javascript_tag do %>
          if (n<o.length) {
            <% if condition %>
              doSomething()
            <% end %>
          }
        <% end %>
      HTML

      assert_parsed_snapshot(template, action_view_helpers: true)
      assert_parsed_snapshot(template)
    end

    test "javascript_tag with nonce false" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= javascript_tag nonce: false do %>
          alert('Hello')
        <% end %>
      HTML
    end

    test "javascript_tag inline CDATA matches ActionView output" do
      assert_evaluated_actionview_snapshot('<%= javascript_tag "alert(1)" %>')
    end

    test "javascript_tag block CDATA matches ActionView output" do
      assert_evaluated_actionview_snapshot(<<~ERB)
        <%= javascript_tag do %>
          alert(1)
        <% end %>
      ERB
    end

    test "javascript_tag with type attribute CDATA matches ActionView output" do
      assert_evaluated_actionview_snapshot('<%= javascript_tag "alert(1)", type: "application/javascript" %>')
    end
  end
end
