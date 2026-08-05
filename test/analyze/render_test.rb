# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class RenderTest < Minitest::Spec
    include SnapshotUtils

    test "render with partial string" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render "shared/header" %>
      HTML
    end

    test "render with partial keyword" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render partial: "product" %>
      HTML
    end

    test "render with partial and locals" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render partial: "card", locals: { title: @title, body: "Hello" } %>
      HTML
    end

    test "render with implicit locals" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render "card", title: @title, subtitle: "Hello" %>
      HTML
    end

    test "render with collection" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render partial: "product", collection: @products %>
      HTML
    end

    test "render with collection and as" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render partial: "product", collection: @products, as: :item %>
      HTML
    end

    test "render with layout without block" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render layout: "wrapper" %>
      HTML
    end

    test "render with object" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render @product %>
      HTML
    end

    test "render with template" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render template: "posts/show" %>
      HTML
    end

    test "render with file" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render file: "/path/to/file" %>
      HTML
    end

    test "render with inline" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render inline: "<%= name %>" %>
      HTML
    end

    test "render with body" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render body: "Hello, World!" %>
      HTML
    end

    test "render with plain" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render plain: "Hello, World!" %>
      HTML
    end

    test "render with html" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render html: "<h1>Hello</h1>".html_safe %>
      HTML
    end

    test "render with renderable" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render renderable: Greeting.new %>
      HTML
    end

    test "render with spacer_template" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render partial: "product", collection: @products, spacer_template: "product_spacer" %>
      HTML
    end

    test "render with formats" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render template: "posts/content", formats: [:text] %>
      HTML
    end

    test "render with variants" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render template: "posts/content", variants: [:tablet] %>
      HTML
    end

    test "render with handlers" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render template: "posts/content", handlers: [:builder] %>
      HTML
    end

    test "render with content_type" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render partial: "card", content_type: "text/html" %>
      HTML
    end

    test "render disabled by default" do
      assert_parsed_snapshot(<<~HTML)
        <%= render "header" %>
      HTML
    end

    test "render with ambiguous locals error" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render "card", locals: { title: @title } %>
      HTML
    end

    test "render with missing locals error" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render partial: "card", title: @title, subtitle: "Hello" %>
      HTML
    end

    test "render with explicit partial and locals has no error" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render partial: "card", locals: { title: @title } %>
      HTML
    end

    test "non-render erb unchanged" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= user.name %>
      HTML
    end

    test "render with no arguments error" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render %>
      HTML
    end

    test "render with conflicting partial error" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render "card", partial: "other" %>
      HTML
    end

    test "render with invalid as option error" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render partial: "product", collection: @products, as: "Invalid-Name" %>
      HTML
    end

    test "render with object and collection error" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render partial: "product", object: @product, collection: @products %>
      HTML
    end

    test "render with render_nodes and prism_nodes" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true, prism_nodes: true)
        <%= render partial: "card", locals: { title: @title } %>
      HTML
    end

    test "render with implicit locals that share render keyword names" do
      assert_parsed_snapshot(<<~HTML, render_nodes: true)
        <%= render "card", title: @title, body: "Hello", layout: "wide" %>
      HTML
    end
  end
end
