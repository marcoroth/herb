# frozen_string_literal: true
# typed: true

module Herb
  class Visitor
    # The ordered list of passes the engine runs over a template before it compiles.
    #
    # Order is part of the contract rather than an implementation detail. A pass that injects nodes
    # has to run after one that assigns positions to the nodes already there, and a pass that
    # annotates the final tree has to run last. An array expresses that only by luck, so this adds
    # the vocabulary to say it:
    #
    #     stack.insert_after(Herb::Engine::Slots::Visitor, MyVisitor.new)
    #
    # @rbs inherits Array[untyped]
    class Stack < Array
      class UnknownVisitorError < ArgumentError; end
      class OrderError < ArgumentError; end

      #: (untyped) -> Stack
      def self.build(visitors)
        stack = new
        stack.replace(Array(visitors))
        stack
      end

      #: () -> void
      def validate_order!
        each_with_index do |visitor, position|
          validate_inlining!(visitor, position)
          validate_reading!(visitor, position)
        end

        nil
      end

      private

      #: (untyped, Integer) -> void
      def validate_inlining!(visitor, position)
        return unless answers?(visitor, :inlines_renders?)
        return if position.zero?

        earlier = self[position - 1]

        raise OrderError, "#{visitor.class} brings markup from other templates into this one, so it has to run first. #{earlier.class} would otherwise never see what it brought in. Put it first in `visitors:`."
      end

      #: (untyped, Integer) -> void
      def validate_reading!(visitor, position)
        return unless answers?(visitor, :reads_erb_source?)

        rewriter = take(position).find { |earlier| answers?(earlier, :rewrites_erb_source?) }

        return unless rewriter

        raise OrderError, "#{visitor.class} reads the ERB a template was written with, so it has to run before #{rewriter.class}, which rewrites it. Put it earlier in `visitors:`."
      end

      #: (untyped, Symbol) -> bool
      def answers?(visitor, question)
        klass = visitor.class

        klass.respond_to?(question) && klass.public_send(question)
      end

      public

      #: (untyped) -> Stack
      def use(visitor)
        push(visitor)

        self
      end

      # Takes an index, the way `Array#insert` does, or a visitor class to place against.
      #: ((Integer | Module), *untyped) -> Stack
      def insert(anchor, *visitors)
        index = position_of(anchor)

        visitors.reverse_each { |visitor| super(index, visitor) }

        self
      end

      alias insert_before insert

      #: ((Integer | Module), *untyped) -> Stack
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
