# frozen_string_literal: true

require_relative "test_helper"

class EngineVisitorsTest < Minitest::Spec
  test "engine works without any visitors" do
    html = "<div>Hello World</div>"

    engine = Herb::Engine.new(html)

    expected = "_buf = ::String.new; _buf << '<div>Hello World</div>'.freeze;\n_buf.to_s\n"
    assert_equal expected, engine.src
  end

  test "engine runs visitors in the order provided" do
    html = "<div>Test</div>"

    execution_order = []

    visitor1 = Class.new(Herb::Visitor) do
      define_method(:initialize) do |order_array|
        super()
        @order_array = order_array
      end

      define_method(:visit_document_node) do |node|
        @order_array << "visitor1"
        super(node)
      end
    end.new(execution_order)

    visitor2 = Class.new(Herb::Visitor) do
      define_method(:initialize) do |order_array|
        super()
        @order_array = order_array
      end

      define_method(:visit_document_node) do |node|
        @order_array << "visitor2"
        super(node)
      end
    end.new(execution_order)

    visitors = [visitor1, visitor2]

    engine = Herb::Engine.new(html, visitors: visitors)

    assert_equal ["visitor1", "visitor2"], execution_order

    expected = "_buf = ::String.new; _buf << '<div>Test</div>'.freeze;\n_buf.to_s\n"
    assert_equal expected, engine.src
  end

  test "accessibility audit applies alongside visitors provided by the caller" do
    html = "<h1><%= title %></h1>"

    other = Class.new(Herb::Visitor).new

    engine = Herb::Engine.new(html, visitors: [other], accessibility_audit: true, filename: "test.html.erb")

    assert_equal 2, engine.visitors.length
    assert_includes engine.src, "::Herb::Engine::AccessibilityAudit.push_name"
  end

  test "accessibility audit does not instrument twice when the visitor is passed explicitly" do
    html = "<h1><%= title %></h1>"

    visitor = Herb::Engine::AccessibilityAudit::Visitor.new(file_path: "test.html.erb")

    engine = Herb::Engine.new(html, visitors: [visitor], accessibility_audit: true, filename: "test.html.erb")

    assert_equal 1, engine.visitors.length
    assert_equal 1, engine.src.scan("AccessibilityAudit.push_name").length
  end

  test "accessibility audit visitor can be used explicitly" do
    html = "<h1><%= title %></h1>"

    visitor = Herb::Engine::AccessibilityAudit::Visitor.new(
      file_path: "test.html.erb",
      project_path: "/project"
    )

    engine = Herb::Engine.new(html, visitors: [visitor], accessibility_audit: false)

    assert_includes engine.src, "::Herb::Engine::AccessibilityAudit.push_name"
  end

  test "debug visitor can still be used explicitly" do
    html = "<div>Debug test</div>"

    debug_visitor = Herb::Engine::DebugVisitor.new(
      file_path: "test.html.erb",
      project_path: "/project"
    )

    visitors = [debug_visitor]

    engine = Herb::Engine.new(html, visitors: visitors, debug: false)

    refute_nil engine.src
  end

  HTML = "<div><%= name %></div>"

  def prism_node_visitor(&declaration)
    Class.new(Herb::Visitor) do
      attr_reader :prism_node

      class_eval(&declaration) if declaration

      def visit_document_node(node)
        @prism_node = node.prism_node

        super
      end
    end.new
  end

  test "a parser option a visitor requires is turned on" do
    visitor = prism_node_visitor { required_parser_option prism_program: true }

    engine = Herb::Engine.new(HTML, visitors: [visitor])

    refute_nil engine.src
    refute_nil visitor.prism_node
  end

  test "a parser option a visitor requires can be passed to the engine as well" do
    visitor = prism_node_visitor { required_parser_option prism_program: true }

    engine = Herb::Engine.new(HTML, visitors: [visitor], parser_options: { prism_program: true })

    refute_nil engine.src
    refute_nil visitor.prism_node
  end

  test "a parser option passed to the engine that a visitor requires otherwise raises" do
    visitor = prism_node_visitor { required_parser_option prism_program: true }

    error = assert_raises(ArgumentError) do
      Herb::Engine.new(HTML, visitors: [visitor], parser_options: { prism_program: false })
    end

    assert_includes error.message, "requires the `prism_program` parser option to be true, but it is set to false"
  end

  test "two visitors requiring the same parser option differently raises" do
    visitors = [
      prism_node_visitor { required_parser_option prism_program: true },
      prism_node_visitor { required_parser_option prism_program: false }
    ]

    assert_raises(ArgumentError) do
      Herb::Engine.new(HTML, visitors: visitors)
    end
  end

  test "a parser option a visitor recommends is turned on" do
    visitor = prism_node_visitor { recommended_parser_option prism_program: true }

    engine = Herb::Engine.new(HTML, visitors: [visitor])

    refute_nil engine.src
    refute_nil visitor.prism_node
  end

  test "a parser option passed to the engine that a visitor recommends otherwise warns" do
    visitor = prism_node_visitor { recommended_parser_option prism_program: true }
    engine = nil

    _out, err = capture_io do
      engine = Herb::Engine.new(HTML, visitors: [visitor], parser_options: { prism_program: false })
    end

    assert_includes err, "recommends the `prism_program` parser option to be true, but it is set to false"
    refute_nil engine.src
    assert_nil visitor.prism_node
  end

  test "a parser option a visitor recommends does not warn when it is already set to it" do
    visitor = prism_node_visitor { recommended_parser_option prism_program: true }

    _out, err = capture_io do
      Herb::Engine.new(HTML, visitors: [visitor], parser_options: { prism_program: true })
    end

    assert_empty err
    refute_nil visitor.prism_node
  end

  test "visitors without parser options are left alone" do
    visitor = prism_node_visitor

    engine = Herb::Engine.new(HTML, visitors: [visitor])

    refute_nil engine.src
    assert_nil visitor.prism_node
  end
end
