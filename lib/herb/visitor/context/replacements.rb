# frozen_string_literal: true
# typed: false

module Herb
  class Visitor
    class Context
      # Which nodes stand in the tree where another node stood when the compile began.
      #
      # A visitor that rewrites an ERB tag builds a fresh node for it and puts that where the old
      # one was. Any other visitor that recorded something about the old node by identity is then
      # holding a key nothing in the tree matches, and its `finish` walks a tree it no longer
      # recognizes. The rewriter knows what it swapped and the recorder knows what it recorded, so
      # the answer has to live on the compile, where both can reach it.
      #
      #     replacements.record(tag, wrapped)
      #
      #     replacements.original_of(wrapped) #=> tag
      #
      # A chain collapses as it is recorded, so a node replaced twice still answers with the node
      # the compile started from. Only replaced nodes are recorded, so an untouched tree costs
      # nothing.
      #
      class Replacements
        #: () -> void
        def initialize
          originals = {} #: Hash[Herb::AST::Node, Herb::AST::Node]

          @originals = originals.compare_by_identity
        end

        #: (Herb::AST::Node, Herb::AST::Node) -> void
        def record(original, replacement)
          return if original.equal?(replacement)

          @originals[replacement] = original_of(original)

          nil
        end

        #: (Herb::AST::Node) -> Herb::AST::Node
        def original_of(node)
          @originals[node] || node
        end

        #: () -> bool
        def any?
          !@originals.empty?
        end

        #: () { (Herb::AST::Node, Herb::AST::Node) -> void } -> void
        def each(&)
          @originals.each(&)

          nil
        end
      end
    end
  end
end
