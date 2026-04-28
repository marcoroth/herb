# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class RenderBlockTest < Minitest::Spec
    include SnapshotUtils

    test "render with do...end block and arguments" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render BlogComponent.new do |component| %>
          <% component.with_header(classes: "title").with_content("My blog") %>
        <% end %>
      HTML
    end

    test "render with do...end block without arguments" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render LayoutComponent.new do %>
          <p>content</p>
        <% end %>
      HTML
    end

    test "render with inline brace block and arguments" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render AbcComponent.new { |component| component.with_header } %>
      HTML
    end

    test "render with inline brace block without arguments" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render AbcComponent.new { "something" } %>
      HTML
    end

    test "render with do...end block and multiple arguments" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render TableComponent.new do |table, index| %>
          <tr><td><%= index %></td></tr>
        <% end %>
      HTML
    end

    test "render with inline brace block and multiple arguments" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render ListComponent.new { |item, index| item.with_content(index) } %>
      HTML
    end

    test "render with do...end block and partial string" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render "shared/card" do %>
          <p>card content</p>
        <% end %>
      HTML
    end

    test "render with do...end block and keyword partial" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render partial: "shared/card" do %>
          <p>card content</p>
        <% end %>
      HTML
    end

    test "render with do...end block and layout keyword" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render layout: "wrapper" do %>
          <p>wrapped content</p>
        <% end %>
      HTML
    end

    test "render with do...end block containing HTML elements" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render CardComponent.new do |card| %>
          <div class="header">
            <h1>Title</h1>
          </div>
          <div class="body">
            <p>Content</p>
          </div>
        <% end %>
      HTML
    end

    test "render with do...end block containing nested ERB" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render FormComponent.new do |form| %>
          <%= form.input :name %>
          <%= form.input :email %>
          <%= form.submit "Save" %>
        <% end %>
      HTML
    end

    test "render with silent tag and do...end block" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <% render BlogComponent.new do |component| %>
          <% component.with_header %>
        <% end %>
      HTML
    end

    test "render with constructor arguments and inline brace block" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render AbcComponent.new(some_args: :here, that_are_being: "passed") { |component| component.with_header } %>
      HTML
    end

    test "render with optional block argument" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render FormComponent.new do |form = nil| %>
          <p>content</p>
        <% end %>
      HTML
    end

    test "render with rest block argument" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render ListComponent.new do |*items| %>
          <p>content</p>
        <% end %>
      HTML
    end

    test "render with keyword rest block argument" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render ConfigComponent.new do |**options| %>
          <p>content</p>
        <% end %>
      HTML
    end

    test "render with block parameter argument" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render WrapperComponent.new do |&callback| %>
          <p>content</p>
        <% end %>
      HTML
    end

    test "render with mixed block arguments" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render ComplexComponent.new do |item, *rest, **opts, &blk| %>
          <p>content</p>
        <% end %>
      HTML
    end

    test "render with required keyword block argument" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render FormComponent.new do |name:| %>
          <p>content</p>
        <% end %>
      HTML
    end

    test "render with optional keyword block argument with default" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render FormComponent.new do |title: "hello"| %>
          <p>content</p>
        <% end %>
      HTML
    end

    test "render with mixed positional and keyword block arguments" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render FormComponent.new do |component, name:, title: "default"| %>
          <p>content</p>
        <% end %>
      HTML
    end

    test "nested render blocks" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render LayoutComponent.new do |layout| %>
          <%= render CardComponent.new do |card| %>
            <% layout.with_sidebar %>
            <% card.with_header %>
          <% end %>
        <% end %>
      HTML
    end
  end
end
