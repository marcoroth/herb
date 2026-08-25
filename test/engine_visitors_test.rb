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

  test "debug visitor can still be used explicitly" do
    html = "<div>Debug test</div>"

    debug_visitor = Herb::Engine::DebugVisitor.new

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

  class ContextCapturingVisitor < Herb::Visitor
    include Herb::Engine::ContextAware

    attr_reader :seen

    def visit_document_node(node)
      @seen = context

      super
    end
  end

  test "the engine hands its context to a context aware visitor" do
    visitor = ContextCapturingVisitor.new

    Herb::Engine.new("<div>Hi</div>", filename: "app/views/x.html.erb", project_path: "/proj", visitors: [visitor])

    assert_equal "app/views/x.html.erb", visitor.seen.relative_file_path
    assert_equal "/proj", visitor.seen.project_path.to_s
  end

  test "the engine options are reachable from the context" do
    visitor = ContextCapturingVisitor.new

    Herb::Engine.new("<div>Hi</div>", escape: false, visitors: [visitor])

    assert_equal false, visitor.seen.options[:escape]
  end

  test "the visitors option is kept out of the context to avoid a cycle" do
    visitor = ContextCapturingVisitor.new

    Herb::Engine.new("<div>Hi</div>", visitors: [visitor])

    refute visitor.seen.options.key?(:visitors)
  end

  test "caller supplied data reaches the visitor" do
    visitor = ContextCapturingVisitor.new

    Herb::Engine.new("<div>Hi</div>", context: { theme: "dark" }, visitors: [visitor])

    assert_equal "dark", visitor.seen[:theme]
  end

  test "an explicitly set context is not overwritten by the engine" do
    visitor = ContextCapturingVisitor.new
    visitor.context = Herb::Engine::VisitorContext.new(file_path: "explicit.html.erb")

    Herb::Engine.new("<div>Hi</div>", filename: "engine.html.erb", visitors: [visitor])

    assert_equal "explicit.html.erb", visitor.seen.relative_file_path
  end

  test "a reused visitor picks up the second engine's context" do
    visitor = ContextCapturingVisitor.new

    Herb::Engine.new("<div>Hi</div>", filename: "first.html.erb", visitors: [visitor])
    assert_equal "first.html.erb", visitor.seen.relative_file_path

    Herb::Engine.new("<div>Hi</div>", filename: "second.html.erb", visitors: [visitor])
    assert_equal "second.html.erb", visitor.seen.relative_file_path
  end

  test "a visitor that is not context aware is left alone" do
    visitor = Class.new(Herb::Visitor).new

    engine = Herb::Engine.new("<div>Hi</div>", filename: "x.html.erb", visitors: [visitor])

    refute_nil engine.src
    refute_respond_to visitor, :context
  end

  test "a context aware visitor used without an engine still has a context" do
    assert_equal "unknown", ContextCapturingVisitor.new.context.relative_file_path
  end
end
