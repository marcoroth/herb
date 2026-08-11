# frozen_string_literal: true
# typed: false

module Herb
  class Engine
    # Where each node in the tree came from, for the nodes that did not come from the file being
    # compiled.
    #
    # A visitor that splices one template's nodes into another leaves a tree that no longer answers
    # "where was this written" by itself, and a visitor that generates nodes leaves a tree holding
    # positions nobody wrote. Both matter to anything reporting a position back to a developer, and
    # neither is visible from the node alone.
    #
    #     origin.authored(node, "app/views/posts/_card.html.erb", from: render_node)
    #     origin.generated(wrapper)
    #
    #     origin.of(node).file #=> "app/views/posts/_card.html.erb"
    #
    # Only nodes that are not from the file being compiled are recorded, so an untouched tree costs
    # nothing. This lives on the compile rather than on a visitor, because the visitor that needs
    # the answer is never the one that knows it.
    class Origin
      Entry = Data.define(:file, :from)

      class Entry
        #: () -> bool
        def generated?
          file.nil?
        end
      end

      GENERATED = Entry.new(nil, nil) #: Entry

      #: () -> void
      def initialize
        entries = {} #: Hash[Herb::AST::Node, Entry]

        @entries = entries.compare_by_identity
      end

      #: (Herb::AST::Node, String, ?from: Herb::AST::Node?) -> void
      def authored(node, file, from: nil)
        record(node, Entry.new(file, from))
      end

      #: (Herb::AST::Node) -> void
      def generated(node)
        record(node, GENERATED)
      end

      #: (Herb::AST::Node) -> Entry?
      def of(node)
        @entries[node]
      end

      private

      #: (Herb::AST::Node, Entry) -> void
      def record(node, entry)
        @entries[node] = entry unless @entries.key?(node)

        nil
      end
    end
  end
end
