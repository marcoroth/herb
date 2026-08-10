# frozen_string_literal: true

require_relative "test_helper"

class VisitorTest < Minitest::Spec
  class VisitedNodesVisitor < Herb::Visitor
    attr_reader :visited_nodes

    def initialize
      super
      @visited_nodes = []
    end

    def visit_child_nodes(node)
      @visited_nodes << node
      super
    end
  end

  test "visitor" do
    visitor = VisitedNodesVisitor.new

    result = Herb.parse(%(<p id="greeting">Hello <%= user.name %></p>))
    result.visit(visitor)

    expected_nodes = [
      "Herb::AST::DocumentNode",
      "Herb::AST::HTMLElementNode",
      "Herb::AST::HTMLOpenTagNode",
      "Herb::AST::HTMLAttributeNode",
      "Herb::AST::HTMLAttributeNameNode",
      "Herb::AST::LiteralNode",
      "Herb::AST::HTMLAttributeValueNode",
      "Herb::AST::LiteralNode",
      "Herb::AST::HTMLTextNode",
      "Herb::AST::ERBContentNode",
      "Herb::AST::HTMLCloseTagNode"
    ]

    assert result.success?
    assert_equal expected_nodes, visitor.visited_nodes.map(&:class).map(&:to_s)
  end

  test "document with nil in child_nodes" do
    visitor = VisitedNodesVisitor.new

    result = Herb.parse(%(<span>Hello))
    result.visit(visitor)

    expected_nodes = [
      "Herb::AST::DocumentNode",
      "Herb::AST::HTMLOpenTagNode",
      "Herb::AST::HTMLTextNode"
    ]

    assert result.failed?
    assert_equal expected_nodes, visitor.visited_nodes.map(&:class).map(&:to_s)
  end

  test "visitor requires and recommends no parser options by default" do
    assert_empty Herb::Visitor.new.required_parser_options
    assert_empty Herb::Visitor.new.recommended_parser_options
    assert_empty VisitedNodesVisitor.new.required_parser_options
    assert_empty VisitedNodesVisitor.new.recommended_parser_options
  end

  test "required_parser_option declares an option the visitor needs" do
    visitor = Class.new(Herb::Visitor) do
      required_parser_option prism_program: true
    end

    assert_equal({ prism_program: true }, visitor.new.required_parser_options)
    assert_equal({ prism_program: true }, visitor.required_parser_options)
  end

  test "required_parser_option can be called more than once" do
    visitor = Class.new(Herb::Visitor) do
      required_parser_option prism_program: true
      required_parser_option strict: false
    end

    assert_equal({ prism_program: true, strict: false }, visitor.new.required_parser_options)
  end

  test "required_parser_option takes string keys as symbols" do
    visitor = Class.new(Herb::Visitor) do
      required_parser_option "prism_program" => true
    end

    assert_equal({ prism_program: true }, visitor.new.required_parser_options)
  end

  test "required_parser_option is inherited and can be overridden by a subclass" do
    parent = Class.new(Herb::Visitor) do
      required_parser_option prism_program: true
      required_parser_option strict: true
    end

    child = Class.new(parent) do
      required_parser_option strict: false
      required_parser_option analyze: true
    end

    assert_equal({ prism_program: true, strict: true }, parent.new.required_parser_options)
    assert_equal({ prism_program: true, strict: false, analyze: true }, child.new.required_parser_options)
  end

  test "required_parser_option on a subclass leaves the parent alone" do
    parent = Class.new(Herb::Visitor)
    child = Class.new(parent) { required_parser_option prism_program: true }

    assert_empty parent.new.required_parser_options
    assert_equal({ prism_program: true }, child.new.required_parser_options)
  end

  test "recommended_parser_option declares an option the visitor prefers" do
    visitor = Class.new(Herb::Visitor) do
      recommended_parser_option prism_program: true
      recommended_parser_option strict: false
    end

    assert_equal({ prism_program: true, strict: false }, visitor.new.recommended_parser_options)
    assert_equal({ prism_program: true, strict: false }, visitor.recommended_parser_options)
  end

  test "recommended_parser_option is inherited and can be overridden by a subclass" do
    parent = Class.new(Herb::Visitor) { recommended_parser_option strict: true }
    child = Class.new(parent) { recommended_parser_option strict: false }

    assert_equal({ strict: true }, parent.new.recommended_parser_options)
    assert_equal({ strict: false }, child.new.recommended_parser_options)
  end

  test "required and recommended parser options are kept apart" do
    visitor = Class.new(Herb::Visitor) do
      required_parser_option prism_program: true
      recommended_parser_option strict: false
    end

    assert_equal({ prism_program: true }, visitor.new.required_parser_options)
    assert_equal({ strict: false }, visitor.new.recommended_parser_options)
  end

  test "declared parser options cannot be changed through the reader" do
    visitor = Class.new(Herb::Visitor) { required_parser_option prism_program: true }

    visitor.required_parser_options[:strict] = false

    assert_equal({ prism_program: true }, visitor.new.required_parser_options)
  end

  test "parser_options_for collects what an array of visitors asks for" do
    visitors = [
      Class.new(Herb::Visitor) { required_parser_option prism_program: true }.new,
      Class.new(Herb::Visitor) { recommended_parser_option analyze: true }.new,
      Class.new(Herb::Visitor).new
    ]

    assert_equal({ prism_program: true, analyze: true }, Herb::Visitor.parser_options_for(visitors))
  end

  test "parser_options_for keeps the options it was given" do
    visitors = [Class.new(Herb::Visitor) { required_parser_option prism_program: true }.new]

    assert_equal({ strict: false, prism_program: true }, Herb::Visitor.parser_options_for(visitors, { strict: false }))
  end

  test "parser_options_for takes the given options with string keys" do
    visitors = [Class.new(Herb::Visitor) { required_parser_option prism_program: true }.new]

    assert_equal({ strict: false, prism_program: true }, Herb::Visitor.parser_options_for(visitors, { "strict" => false }))
  end

  test "parser_options_for does not change the options it was given" do
    visitors = [Class.new(Herb::Visitor) { required_parser_option prism_program: true }.new]
    given = { strict: false }

    Herb::Visitor.parser_options_for(visitors, given)

    assert_equal({ strict: false }, given)
  end

  test "parser_options_for raises when a required option conflicts" do
    visitors = [Class.new(Herb::Visitor) { required_parser_option prism_program: true }.new]

    error = assert_raises(ArgumentError) do
      Herb::Visitor.parser_options_for(visitors, { prism_program: false })
    end

    assert_includes error.message, "requires the `prism_program` parser option to be true, but it is set to false"
  end

  test "parser_options_for warns and keeps the given value when a recommended option conflicts" do
    visitors = [Class.new(Herb::Visitor) { recommended_parser_option prism_program: true }.new]
    options = nil

    _out, err = capture_io do
      options = Herb::Visitor.parser_options_for(visitors, { prism_program: false })
    end

    assert_includes err, "recommends the `prism_program` parser option to be true, but it is set to false"
    assert_equal({ prism_program: false }, options)
  end

  test "parser_options_for accepts visitors that know nothing about parser options" do
    assert_empty Herb::Visitor.parser_options_for([Object.new])
    assert_empty Herb::Visitor.parser_options_for([])
  end

  test "a class that is not a visitor can declare parser options too" do
    klass = Class.new do
      include Herb::Visitor::ParserOptionRequirements

      required_parser_option prism_program: true
      recommended_parser_option strict: false
    end

    visitor = klass.new

    assert_equal({ prism_program: true }, visitor.required_parser_options)
    assert_equal({ strict: false }, visitor.recommended_parser_options)
    assert_equal({ prism_program: true, strict: false }, Herb::Visitor.parser_options_for([visitor]))
    assert_equal({ prism_program: true, strict: false }, klass.parser_options_for([visitor]))
  end
end
