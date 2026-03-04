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
end
