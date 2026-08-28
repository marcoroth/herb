# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require "herb/engine/optimize_visitor"

module Engine
  class StaticTemplateOptimizationTest < Minitest::Spec
    include SnapshotUtils

    HTML_ONLY_TEMPLATE = <<~HTML
      <header class="site-header">
        <nav class="navbar">
          <div class="container">
            <a href="/" class="logo">
              <img src="/images/logo.svg" alt="Company Name">
            </a>
          </div>
        </nav>
      </header>
    HTML

    def optimize(source, **)
      Herb::Engine.new(source, visitors: [Herb::Engine::OptimizeVisitor.new], **).src
    end

    class AlwaysWarns < Herb::Visitor
      include Herb::Engine::Diagnostics

      def inspect = "#<#{self.class.name}>"

      def visit_html_element_node(node)
        warning("noticed an element", node.location, code: "noticed-element")

        super
      end
    end

    class AlwaysErrors < Herb::Visitor
      include Herb::Engine::Diagnostics

      def fatal? = true

      def visit_html_element_node(node)
        error("this element is broken", node.location, code: "broken-element")

        super
      end
    end

    test "an HTML-only template compiles to a bare string literal" do
      assert_compiled_snapshot("<div class=\"a\">Hello</div>", visitors: [Herb::Engine::OptimizeVisitor.new])
    end

    test "a nested multi-line document collapses to the string it renders" do
      collapsed = optimize(HTML_ONLY_TEMPLATE)

      assert_compiled_snapshot(HTML_ONLY_TEMPLATE, visitors: [Herb::Engine::OptimizeVisitor.new])
      assert_equal HTML_ONLY_TEMPLATE, eval(collapsed)
    end

    test "the collapsed literal renders the same string as the buffered form" do
      [
        "<div class=\"a\">Hi</div>",
        "text with 'quotes' and \\ backslash",
        "<!DOCTYPE html>\n<p>x</p>\n",
        ""
      ].each do |source|
        buffered = Herb::Engine.new(source).src
        collapsed = optimize(source)

        assert_equal eval(buffered), eval(collapsed), source.inspect
        assert_equal source, eval(collapsed), source.inspect
      end
    end

    test "an empty template collapses to an empty literal" do
      assert_equal "''.freeze", optimize("")
    end

    test "escaping is preserved in the collapsed literal" do
      collapsed = optimize("it's a \\ backslash")

      assert_equal "'it\\'s a \\\\ backslash'.freeze", collapsed
    end

    test "the optimization only applies when OptimizeVisitor is present" do
      source = "<div>Static</div>"

      assert_compiled_snapshot(source)
      assert_compiled_snapshot(source, visitors: [Herb::Engine::OptimizeVisitor.new])
    end

    test "a template with dynamic ERB stays buffered" do
      assert_compiled_snapshot("<div><%= name %></div>", visitors: [Herb::Engine::OptimizeVisitor.new])
    end

    test "a helper that resolves to static markup collapses too" do
      collapsed = optimize("<div><%= tag.br %></div>")

      assert_equal "'<div><br></div>'.freeze", collapsed
    end

    test "a custom preamble keeps the buffer" do
      assert_compiled_snapshot("<div>hi</div>", preamble: "@output = +''", visitors: [Herb::Engine::OptimizeVisitor.new])
    end

    test "a custom postamble keeps the buffer" do
      assert_compiled_snapshot("<div>hi</div>", postamble: "@output_buffer", visitors: [Herb::Engine::OptimizeVisitor.new])
    end

    test "the ensure wrapper keeps the buffer" do
      assert_compiled_snapshot("<div>hi</div>", ensure: true, visitors: [Herb::Engine::OptimizeVisitor.new])
    end

    test "a recorded diagnostic keeps the buffer so the report survives" do
      assert_compiled_snapshot("<div>hi</div>", visitors: [Herb::Engine::OptimizeVisitor.new, AlwaysWarns.new])
    end

    test "a fatal diagnostic still raises instead of collapsing" do
      assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(
          "<div>hi</div>",
          visitors: [Herb::Engine::OptimizeVisitor.new, AlwaysErrors.new]
        )
      end
    end
  end
end
