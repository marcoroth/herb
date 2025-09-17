# frozen_string_literal: true

require_relative "test_helper"

class EngineVisitorsTest < Minitest::Spec
  test "engine works without any visitors" do
    html = '<div>Hello World</div>'

    engine = Herb::Engine.new(html)

    expected = "_buf = ::String.new;\n _buf << '<div>Hello World</div>'.freeze;\n_buf.to_s\n"
    assert_equal expected, engine.src
  end

  test "engine runs visitors in the order provided" do
    html = '<div>Test</div>'

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

    expected = "_buf = ::String.new;\n _buf << '<div>Test</div>'.freeze;\n_buf.to_s\n"
    assert_equal expected, engine.src
  end

  test "debug visitor can still be used explicitly" do
    html = '<div>Debug test</div>'

    debug_visitor = Herb::Engine::DebugVisitor.new(
      file_path: "test.html.erb",
      project_path: "/project"
    )

    visitors = [debug_visitor]

    engine = Herb::Engine.new(html, visitors: visitors, debug: false)

    refute_nil engine.src
  end

  private

  def mock_engine
    engine = Object.new
    def engine.filename; Pathname.new("test.html.erb"); end
    def engine.relative_file_path; "views/test.html.erb"; end
    def engine.debug; false; end
    engine
  end
end
