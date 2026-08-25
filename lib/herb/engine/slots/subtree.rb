# frozen_string_literal: true
# typed: false

require_relative "../../../herb"
require_relative "../../engine"
require_relative "visitor"
require_relative "subtree_compiler"

module Herb
  class Engine
    module Slots
      # Compiles the markup behind one slot, for the cases a client cannot answer for itself.
      #
      #     subtree = Herb::Engine::Slots::Subtree.new(source, filename: "app/views/posts/index.html.erb")
      #     view.instance_eval(subtree.source_for(0))
      #     #=> "<li>one</li><li>two</li>"
      #
      # Values carry a page most of the way. What they cannot carry is markup the page never had:
      # a conditional taking a branch that did not render, or a collection gaining its first item.
      # Both come back from `SlotIndex#apply` as a deferred entry naming the slot, and this is what
      # answers one.
      #
      # A slot is addressed by its index, which is what the payload and the deferred entry both use.
      # `Visitor` records the `node_path` of each slot and `SubtreeCompiler` renders the node at
      # a path, so the index is resolved through the schema.
      #
      # An attribute is not addressable. A path indexes an element's body and does not descend into
      # its open tag, so the path of an attribute slot names the element holding it, and compiling
      # that would return the whole element where the caller asked for one attribute. Those slots
      # are values, and values is how they come back.
      #
      class Subtree
        attr_reader :slots, :version #: Array[untyped]

        #: (String, ?filename: String?) -> void
        def initialize(source, filename: nil)
          @source = source
          @filename = filename

          visitor = Herb::Engine::Slots::Visitor.new

          Herb::Engine.new(source, visitors: [visitor], filename: filename)

          @slots = visitor.slots
          @version = visitor.schema[:version]
        end #: String

        #: (Integer) -> Array[Integer]?
        def node_path_for(index)
          slot_for(index)&.node_path
        end

        #: (Integer) -> bool
        def addressable?(index)
          slot = slot_for(index)

          return false unless slot

          !slot.attribute?
        end

        #: (Integer) -> String?
        def source_for(index)
          return nil unless addressable?(index)

          path = node_path_for(index)

          return nil unless path

          Herb::Engine::Slots::SubtreeCompiler.new(@source, node_path: path, filename: @filename).src
        end

        private

        #: (Integer) -> untyped
        def slot_for(index)
          @slots.find { |slot| slot.index == index }
        end
      end
    end
  end
end
