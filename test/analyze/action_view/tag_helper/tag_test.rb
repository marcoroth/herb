# frozen_string_literal: true

require_relative "../../../test_helper"

module Analyze::ActionView::TagHelper
  class TagTest < Minitest::Spec
    include SnapshotUtils

    test "tag.div" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div %>
      HTML
    end

    test "tag.div with block" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div do %>
          Content
        <% end %>
      HTML
    end

    test "tag.div with string content as argument" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div "Content" %>
      HTML
    end

    xtest "tag.div with variable content as argument" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div content %>
      HTML
    end

    test "tag.div with content as argument and attributes" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div "Content", id: "hello" %>
      HTML
    end

    xtest "tag.div with content as argument and class attribute" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div "Content", class: "content" %>
      HTML
    end

    xtest "tag.div with data attributes in hash style" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div data: { controller: "content", user_id: 123 } do %>
          Content
        <% end %>
      HTML
    end

    xtest "tag.div with attributes in string key hash style" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div, "data-controller" => "example", "data-user-id": 123 do %>
          Content
        <% end %>
      HTML
    end

    xtest "tag.div with data attributes in underscore style" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div data_controller_name: "content", data_user_id: 123 do %>
          Content
        <% end %>
      HTML
    end

    xtest "tag.div with data attributes in string key hash style" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div, data: { "controller-name" => "example", "user-id" => 123 } do %>
          Content
        <% end %>
      HTML
    end

    xtest "tag.div with variable attribute value" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div class: class_name do %>
          Content
        <% end %>
      HTML
    end

    xtest "tag.div with attributes splat" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div class: "content", **attributes do %>
          Content
        <% end %>
      HTML
    end

    xtest "tag.span with attributes" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.span(class: "highlight", id: "main") %>
      HTML
    end

    xtest "tag.button with complex attributes" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.button(class: "btn btn-primary", type: "submit", disabled: true) %>
      HTML
    end

    xtest "tag.section with id and class" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.section(id: "content", class: "container") %>
      HTML
    end

    test "tag with underscore in name" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.my_component %>
      HTML
    end

    test "tag with hyphenated name" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.custom_element %>
      HTML
    end

    xtest "tag with numeric attributes" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.input(type: "number", value: 42, min: 0, max: 100) %>
      HTML
    end

    xtest "tag with string and symbol attributes mixed" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.article("data-id" => "123", class: "post", :title => "Hello") %>
      HTML
    end

    xtest "tag with complex nested attributes" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div(data: { controller: "example", target: "output" }) %>
      HTML
    end

    xtest "tag with variable in attribute value" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.p(class: css_class, id: element_id) %>
      HTML
    end

    xtest "tag with method call in attribute" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.img(src: image_path("logo.png"), alt: "Logo") %>
      HTML
    end

    test "tag with extra whitespace" do
      assert_parsed_snapshot(<<~HTML)
        <%=   tag.header   %>
      HTML
    end

    test "tag with parentheses but no arguments" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.footer() %>
      HTML
    end

    xtest "tag with multiline attributes" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.form(
              action: "/submit",
              method: "post",
              class: "form"
            ) %>
      HTML
    end

    test "tag.div with complex attributes and enhanced location tracking" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div id: "container",
                    class: "wrapper #{dynamic_class}",
                    data: { toggle: "modal", target: "#myModal" },
                    aria: { label: "Close button" },
                    **extra_attributes do %>
          <p>Content with multiple attribute types</p>
        <% end %>
      HTML
    end

    xtest "tag.div block with missing quote in data attributes hash" do
      assert_parsed_snapshot(<<~HTML)
        <%= tag.div data: { controller: "hello } do %>

        <% end %>
      HTML
    end
  end
end
