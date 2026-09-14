# frozen_string_literal: true

require_relative "types"

module Herb
  class Engine
    module Slots
      # What the visitor knows about one slot while it is still reading the template.
      #
      # A slot's index is its address, and an address cannot be handed out until it is known which
      # slots survive: collapsing an invariant conditional drops one and merges the branches behind
      # it. So the walk records annotations, which carry no index and can be marked as it learns
      # more, and only the final pass turns the survivors into numbered slots.
      #
      class Annotation
        attr_reader :node #: untyped
        attr_accessor :type #: Symbol
        attr_reader :node_path #: Array[Integer]
        attr_accessor :expression #: String?
        attr_accessor :attribute #: String?
        attr_reader :key_source #: Symbol?
        attr_reader :key_expression #: String?
        attr_reader :tag #: String?
        attr_reader :scope #: untyped
        attr_reader :depth #: Integer

        attr_accessor :index #: Integer?
        attr_accessor :name #: String?
        attr_accessor :dropped #: bool
        attr_accessor :merged_into #: Annotation?
        attr_reader :covered #: Array[Annotation]

        #: (node: untyped, type: Symbol, node_path: Array[Integer], expression: String?, attribute: String?, key_source: Symbol?, key_expression: String?, tag: String?, scope: untyped, depth: Integer) -> void
        def initialize(node:, type:, node_path:, expression:, attribute:, key_source:, key_expression:, tag:, scope:, depth:) # rubocop:disable Metrics/ParameterLists
          @node = node
          @type = type
          @node_path = node_path
          @expression = expression
          @attribute = attribute
          @key_source = key_source
          @key_expression = key_expression
          @tag = tag
          @scope = scope
          @depth = depth

          @index = nil
          @name = nil
          @dropped = false
          @merged_into = nil
          @covered = [] #: Array[Annotation]
        end

        #: () -> bool
        def gone? = @dropped || !@merged_into.nil?

        #: () -> Annotation
        def survivor
          found = self #: Annotation

          found = found.merged_into while found.merged_into

          found
        end

        #: () -> bool
        def structural? = Types.structural?(type)

        #: () -> bool
        def attribute? = Types.attribute?(type)

        #: () -> bool
        def anchored? = Types.element_anchored?(type)

        #: () -> bool
        def nameable? = Types.nameable?(type)

        #: () -> bool
        def valued? = Types.valued?(type)

        #: (Integer) -> untyped
        def to_slot(index)
          Visitor::Slot.new(
            index: index,
            type: type,
            node_path: node_path,
            expression: expression,
            attribute: attribute,
            key_source: key_source,
            key_expression: key_expression,
            name: name,
            tag: tag,
            merged_paths: covered.map(&:node_path)
          )
        end
      end
    end
  end
end
