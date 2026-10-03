# frozen_string_literal: true
# typed: false

module Herb
  class Visitor
    class Context
      # Which nodes hold content that was written somewhere other than the file being compiled.
      #
      # A visitor that splices one template into another leaves a tree that no longer answers "where
      # was this written" by itself, and the node it wraps the splice in is one nobody wrote at all.
      # Both matter to anything reporting a position back to a developer, and neither is visible from
      # the node alone.
      #
      #     origin.authored(wrapper, "app/views/posts/_card.html.erb", from: render_node)
      #
      #     origin.of(wrapper).file #=> "app/views/posts/_card.html.erb"
      #     origin.of(wrapper).from #=> the `render` tag it replaced
      #
      # What is recorded is the node holding the content rather than each node of it, because what
      # was moved is the partial and not each node of the partial. Recording the nodes themselves
      # would leave nothing saying which of them belong together, and a partial spliced into the
      # middle of another would split the one around it in two.
      #
      # Only nodes that hold content from elsewhere are recorded, so an untouched tree costs nothing.
      # This lives on the compile rather than on a visitor, because the visitor that needs the answer
      # is never the one that knows it.
      #
      class Origin
        Entry = Data.define(:file, :from)

        #: () -> void
        def initialize
          entries = {} #: Hash[Herb::AST::Node, Entry]

          @entries = entries.compare_by_identity
        end

        #: (Herb::AST::Node, String, ?from: Herb::AST::Node?) -> void
        def authored(node, file, from: nil)
          @entries[node] = Entry.new(file, from) unless @entries.key?(node)

          nil
        end

        #: (Herb::AST::Node) -> Entry?
        def of(node)
          @entries[node]
        end
      end
    end
  end
end
