# frozen_string_literal: true
# typed: true

module Herb
  class Engine
    # The ordered list of passes the engine runs over a template before it compiles.
    #
    # Order is part of the contract rather than an implementation detail. A pass that injects nodes
    # has to run after one that assigns positions to the nodes already there, and a pass that
    # annotates the final tree has to run last. An array expresses that only by luck, so this adds
    # the vocabulary to say it:
    #
    #     stack.insert_after(Herb::Engine::SlotVisitor, MyVisitor.new)
    #
    # @rbs inherits Array[untyped]
    class VisitorStack < Array
      class UnknownVisitorError < ArgumentError; end

      #: (untyped) -> VisitorStack
      def self.build(visitors)
        stack = new
        stack.replace(Array(visitors))
        stack
      end

      #: (untyped) -> VisitorStack
      def use(visitor)
        push(visitor)

        self
      end

      # Takes an index, the way `Array#insert` does, or a visitor class to place against.
      #: ((Integer | Module), *untyped) -> VisitorStack
      def insert(anchor, *visitors)
        index = position_of(anchor)

        visitors.reverse_each { |visitor| super(index, visitor) }

        self
      end

      alias insert_before insert

      #: ((Integer | Module), *untyped) -> VisitorStack
      def insert_after(anchor, *visitors)
        index = position_of(anchor) + 1

        visitors.reverse_each { |visitor| insert(index, visitor) }

        self
      end

      #: (Module) -> bool
      def include_visitor?(anchor)
        any? { |visitor| visitor.is_a?(anchor) }
      end

      private

      #: ((Integer | Module)) -> Integer
      def position_of(anchor)
        return anchor if anchor.is_a?(Integer)

        index_of(anchor)
      end

      #: (Module) -> Integer
      def index_of(anchor)
        index = find_index { |visitor| visitor.is_a?(anchor) }

        raise UnknownVisitorError, "no visitor in the stack is a #{anchor}" unless index

        index
      end
    end
  end
end
