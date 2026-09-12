# frozen_string_literal: true
# typed: true

module Herb
  # Finds the most specific node at a position, and the nodes it sits inside.
  #
  #     result = document.locate(Herb::Position.from(2, 7))
  #
  #     result.node      #=> the innermost node whose location contains the position
  #     result.ancestors #=> every node it sits inside, nearest first
  #
  # A node and a parse result both answer, so a walk starts from whichever one a caller already
  # holds. `Herb::AST::Node#locate` and `Herb::ParseResult#locate` are the same walk from different
  # starting points.
  #
  # Everything that reads a position back from a rendered page, an editor, or a diagnostic needs
  # this, and every caller was writing its own descent. A finding at `2:7` is a node before it is
  # anything a person can act on.
  #
  # `ancestors` reads nearest first, the way `caller` does, so the enclosing element a caller wants
  # is the first one that answers:
  #
  #     result.ancestors.find { |node| node.is_a?(Herb::AST::HTMLElementNode) }
  #
  # A node's location contains its start and stops short of its end, so two nodes sitting next to
  # each other never both answer for the character between them. A position past the end of the
  # source belongs to no node, and the answer is `nil`.
  #
  # Columns are 0-based character offsets into their line, which is what the parser reports.
  # `Herb::Position#to_one_based` is what turns one into what an editor shows.
  #
  # `Herb::Locate::Result` holds what was found, and what it was found inside.
  #
  #     result.node      #=> #<Herb::AST::LiteralNode>
  #     result.ancestors #=> [#<...HTMLAttributeNameNode>, #<...HTMLAttributeNode>, ...]
  #
  class Locate
    class Result
      attr_reader :node #: Herb::AST::Node
      attr_reader :ancestors #: Array[Herb::AST::Node]

      #: (Herb::AST::Node, Array[Herb::AST::Node]) -> void
      def initialize(node, ancestors)
        @node = node
        @ancestors = ancestors

        freeze
      end

      #: (untyped) -> Herb::AST::Node?
      def innermost(kind)
        return node if node.is_a?(kind)

        ancestors.find { |ancestor| ancestor.is_a?(kind) } #: Herb::AST::Node?
      end

      #: () -> Array[Herb::AST::Node]
      def path
        ancestors.reverse + [node]
      end

      #: () -> String
      def inspect
        %(#<Herb::Locate::Result node=#{node.class} ancestors=#{ancestors.size}>)
      end
    end

    #: ((Herb::AST::Node | Herb::ParseResult), Herb::Position) -> Result?
    def self.call(node, position)
      new(position).call(node)
    end

    #: ((Herb::AST::Node | Herb::ParseResult), Herb::Position) -> bool
    def self.locatable?(node, position)
      new(position).locatable?(node)
    end

    #: ((Herb::AST::Node | Herb::ParseResult)) -> Herb::AST::Node
    def self.root(node)
      node.is_a?(Herb::ParseResult) ? node.value : node
    end

    #: (Herb::Position) -> void
    def initialize(position)
      @position = position
      @ancestors = [] #: Array[Herb::AST::Node]
      extents = {} #: Hash[Herb::AST::Node, Herb::Location?]

      @extents = extents.compare_by_identity
    end

    #: ((Herb::AST::Node | Herb::ParseResult)) -> Result?
    def call(node)
      root = self.class.root(node)

      return nil unless within_extent?(root)

      descend(root, [])
    end

    #: ((Herb::AST::Node | Herb::ParseResult)) -> bool
    def locatable?(node)
      within_extent?(self.class.root(node))
    end

    private

    #: (Herb::AST::Node, Array[Herb::AST::Node]) -> Result?
    def descend(node, ancestors)
      child = node.compact_child_nodes.find { |candidate| within_extent?(candidate) }

      return descend(child, [node] + ancestors) if child
      return Result.new(node, ancestors) if contains?(node)

      nearest = ancestors.index { |ancestor| contains?(ancestor) }

      return nil unless nearest

      Result.new(ancestors[nearest], ancestors.drop(nearest + 1))
    end

    #: (Herb::AST::Node) -> bool
    def contains?(node)
      location = node.location

      return false unless location
      return false if location.empty?

      location.contains?(@position)
    end

    #: (Herb::AST::Node) -> bool
    def within_extent?(node)
      extent = extent(node)

      !extent.nil? && extent.contains?(@position)
    end

    #: (Herb::AST::Node) -> Herb::Location?
    def extent(node)
      return @extents[node] if @extents.key?(node)

      @extents[node] = nil

      own = node.location
      own = nil if own.nil? || own.empty?

      extent = node.compact_child_nodes.filter_map { |child| extent(child) }.reduce(own) { |a, b| union(a, b) }

      @extents[node] = extent
    end

    #: (Herb::Location?, Herb::Location) -> Herb::Location
    def union(first, second)
      return second unless first

      Herb::Location.new(
        [first.start, second.start].min, #: Herb::Position
        [first.end, second.end].max #: Herb::Position
      )
    end
  end
end
