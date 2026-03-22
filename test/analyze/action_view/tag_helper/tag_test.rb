# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::TagHelper
  class TagTest < Minitest::Spec
    include SnapshotUtils

    test "tag.div with block" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div do %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with content as argument" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div "Content" %>
      HTML
    end

    test "tag.div with attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div class: "content" do  %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with content as argument and attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div "Content", class: "content" %>
      HTML
    end

    test "tag.div with data attributes in hash style" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div data: { controller: "content", user_id: 123 } do %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with attributes in string key hash style" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div "data-controller" => "example", "data-user-id": 123 do %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with data attributes in underscore style" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div data_controller_name: "content", data_user_id: 123 do %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with data attributes in string key hash style" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div data: { "controller-name" => "example", "user-id" => 123 } do %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with variable attribute value" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div class: class_name do %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with attributes splat" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div class: "content", **attributes do %>
          Content
        <% end %>
      HTML
    end

    test "tag.br void element" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.br %>
      HTML
    end

    test "tag.hr void element with attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.hr class: "divider" %>
      HTML
    end

    test "tag.img void element with attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.img src: "/image.png", alt: "Photo" %>
      HTML
    end

    test "tag.div with attributes in string key hash style without block" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div "data-controller" => "example", "data-user-id": 123 %>
      HTML
    end

    test "tag.div with splat in data hash" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div data: { controller: "example", **data_attrs } do %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with splat in aria hash" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div aria: { label: "hello", **aria_attrs } do %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with only splat in data hash" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div data: { **data_attrs } do %>
          Content
        <% end %>
      HTML
    end

    test "tag.turbo_frame converts underscore to dash" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.turbo_frame id: "tray" do %>
          Content
        <% end %>
      HTML
    end

    test "tag.trix_editor converts underscore to dash" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.trix_editor input: "content", class: "editor" %>
      HTML
    end

    test "tag.my_custom_element converts underscores to dashes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.my_custom_element data: { controller: "example" } do %>
          Content
        <% end %>
      HTML
    end

    test "tag.details with inline block" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.details { "Some content" } %>
      HTML
    end

    test "tag.div with inline block and attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div(class: "container") { "Hello" } %>
      HTML
    end

    test "tag.p with inline block and ruby expression" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.p { @user.name } %>
      HTML
    end

    test "tag.span with inline block" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.span { "Text" } %>
      HTML
    end

    test "tag.div with content argument and block prefers block content" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div("argument") { "Block" } %>
      HTML
    end

    test "tag.div with inline block and data attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div(data: { controller: "example" }) { "Hello" } %>
      HTML
    end

    test "tag.div with content argument and attributes and block prefers block" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div("Content", class: "box") { "Block" } %>
      HTML
    end

    test "tag.script with block" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.script do %>
          alert('Hello')
        <% end %>
      HTML
    end

    test "tag.script with content as argument" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.script "alert('Hello')" %>
      HTML
    end

    test "tag.script with type attribute" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.script type: "application/javascript" do %>
          alert('Hello')
        <% end %>
      HTML
    end

    test "tag.script with src attribute" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.script src: "/assets/application.js", defer: true %>
      HTML
    end

    test "tag.div nested inside unknown helper block is not incorrectly detected as top-level tag helper" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= my_component(data: @items) do |component|
          component.with_slot do
            tag.div class: "container" do
              link_to("Click", url_path)
            end
          end
        end %>
      HTML
    end

    test "tag helpers nested inside lambda inside unknown helper are not incorrectly detected" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= my_table(data: @things) do |table|
          table.with_column(value: lambda do |thing|
            tag.div class: "flex" do
              link_to(thing.name, thing_path(thing))
            end
          end)
        end %>
      HTML
    end

    test "tag.meta nested as argument to content_for is not incorrectly detected as top-level tag helper" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <% content_for :head, tag.meta(name: "viewport", content: "width=device-width, initial-scale=1") %>
      HTML
    end

    test "tag.div with shorthand keyword arguments" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.div(height:, width:) %>
      HTML
    end

    test "tag.script with HTML-like content in block (gh-1426)" do
      template = <<~HTML
        <%= tag.script do %>
          n <o.length
        <% end %>
      HTML

      assert_parsed_snapshot(template, action_view_helpers: true)
      assert_parsed_snapshot(template)
    end

    test "tag.script with less-than in for loop condition (gh-1426)" do
      template = <<~HTML
        <%= tag.script do %>
          for (let i = 0; i<items.length; i++) { console.log(items[i]) }
        <% end %>
      HTML

      assert_parsed_snapshot(template, action_view_helpers: true)
      assert_parsed_snapshot(template)
    end

    test "tag.div inside if block" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <% if condition? %>
          <%= tag.div id: "my-id" do %>
            Content
          <% end %>
        <% end %>
      HTML
    end

    test "tag.img inside if block" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <% if condition? %>
          <%= tag.img src: "/image.png", alt: "Photo" %>
        <% end %>
      HTML
    end

    test "tag.div inside if/else branches" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <% if condition? %>
          <%= tag.div id: "my-id" do %>
            Branch one
          <% end %>
        <% else %>
          <%= tag.span id: "my-id" do %>
            Branch two
          <% end %>
        <% end %>
      HTML
    end

    test "tag.div inside case/when branches" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <% case status %>
        <% when "active" %>
          <%= tag.div class: "active" do %>
            Active
          <% end %>
        <% when "inactive" %>
          <%= tag.div class: "inactive" do %>
            Inactive
          <% end %>
        <% end %>
      HTML
    end

    test "tag.img inside each loop" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <% @items.each do |item| %>
          <%= tag.img src: item.image_url, alt: item.name %>
        <% end %>
      HTML
    end

    test "tag.script with nonce true" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.script(nonce: true) { "alert('Hello')".html_safe } %>
      HTML
    end

    test "tag.script with nonce false" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.script(nonce: false) { "alert('Hello')".html_safe } %>
      HTML
    end

    test "tag.img with content argument reports void element content error" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.img "/image.png" %>
      HTML
    end

    test "tag.img with content argument and data attributes reports void element content error" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <%= tag.img "/image.png", data: { controller: "image" } %>
      HTML
    end

    test "tag.attributes inside HTML open tag extracts attributes" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <input <%= tag.attributes(type: :text, aria: { label: "Search" }) %>>
      HTML
    end

    test "tag.attributes with mixed HTML attributes and disabled false" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <button <%= tag.attributes(id: "call-to-action", disabled: false, aria: { expanded: false }) %> class="primary">Get Started!</button>
      HTML
    end

    test "tag.attributes with attribute before" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <button class="primary" <%= tag.attributes(id: "call-to-action", disabled: false, aria: { expanded: false }) %>>Get Started!</button>
      HTML
    end

    test "tag.attributes with attribute before and after" do
      assert_parsed_snapshot(<<~HTML, action_view_helpers: true)
        <button class="primary" <%= tag.attributes(id: "call-to-action", disabled: false, aria: { expanded: false }) %> data-controller="hello">
          Get Started!
        </button>
      HTML
    end
  end
end
