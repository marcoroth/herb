# frozen_string_literal: true

require_relative "../test_helper"

module Engine
  class RenderNodeCompilationTest < Minitest::Spec
    include SnapshotUtils

    RENDER_NODES = { render_nodes: true }.freeze

    def assert_render_node_snapshot(source)
      assert_compiled_snapshot(source, parser_options: RENDER_NODES)
    end

    test "emits an inline render" do
      assert_render_node_snapshot(%(<div><%= render "shared/header" %></div>))
    end

    test "emits a render with keyword arguments" do
      assert_render_node_snapshot(%(<%= render partial: "x", locals: { a: 1 } %>))
    end

    test "emits a render of a model" do
      assert_render_node_snapshot("<%= render @post %>")
    end

    test "emits a render that takes a block" do
      assert_render_node_snapshot(%(<%= render layout: "box" do %>inner<% end %>))
    end

    test "emits a render in statement position" do
      assert_render_node_snapshot(%(<% render "silent" %>))
    end

    test "emits a render inside a loop" do
      assert_render_node_snapshot(%(<% posts.each do |post| %><%= render post %><% end %>))
    end

    test "compiles the same whether or not render nodes are on" do
      source = %(<div><%= render "shared/header" %></div>)

      assert_equal Herb::Engine.new(source).src, Herb::Engine.new(source, parser_options: RENDER_NODES).src
    end
  end
end
