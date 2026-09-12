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

      DESCRIPTION_LIMIT = 200 #: Integer

      #: (untyped) -> Stack
      def self.build(visitors)
        stack = new
        stack.replace(Array(visitors))
        stack
      end

      #: (untyped) -> Stack
      def self.arrange(visitors)
        build(visitors).arrange
      end

      #: () -> Stack
      def arrange
        remaining = to_a
        ordered = [] #: Array[untyped]

        until remaining.empty?
          ready = remaining.find { |visitor| remaining.none? { |other| !other.equal?(visitor) && precedes?(other, visitor) } }

          raise OrderError, unsatisfiable_message(remaining) unless ready

          ordered << ready
          remaining.delete_if { |visitor| visitor.equal?(ready) }
        end

        self.class.build(ordered)
      end

      #: () -> Array[String]
      def descriptions
        map { |visitor|
          described = visitor.inspect

          described.length > DESCRIPTION_LIMIT ? "#{described[0, DESCRIPTION_LIMIT]}…" : described
        }
      end

      #: () -> void
      def validate_order!
        each_with_index do |visitor, position|
          validate_inlining!(visitor, position)
          validate_reading!(visitor, position)
          validate_style_blocks!(visitor, position)
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
      def validate_style_blocks!(visitor, position)
        return unless answers?(visitor, :reads_style_blocks?)

        rewriter = drop(position + 1).find { |later| answers?(later, :rewrites_style_blocks?) }

        return unless rewriter

        raise OrderError, "#{visitor.class} reads the `<style>` blocks a template holds, so it has to run after #{rewriter.class}, which rewrites them. It would otherwise decide what to do about a block #{rewriter.class} goes on to take out. Put it later in `visitors:`."
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

      #: (untyped, untyped) -> bool
      def precedes?(earlier, later)
        return true if answers?(earlier, :inlines_renders?)
        return true if answers?(earlier, :reads_erb_source?) && answers?(later, :rewrites_erb_source?)

        answers?(earlier, :rewrites_style_blocks?) && answers?(later, :reads_style_blocks?)
      end

      #: (Array[untyped]) -> String
      def unsatisfiable_message(remaining)
        knotted = remaining.select { |visitor| blocked?(visitor, remaining) && blocking?(visitor, remaining) }
        names = (knotted.empty? ? remaining : knotted).map { |visitor| visitor.class.name }.uniq.join(" and ")

        "#{names} each have to run before the other, so no order of the stack satisfies what they declare. Drop one of them, or change what it declares."
      end

      #: (untyped, Array[untyped]) -> bool
      def blocked?(visitor, remaining)
        remaining.any? { |other| !other.equal?(visitor) && precedes?(other, visitor) }
      end

      #: (untyped, Array[untyped]) -> bool
      def blocking?(visitor, remaining)
        remaining.any? { |other| !other.equal?(visitor) && precedes?(visitor, other) }
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
        any?(anchor)
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
