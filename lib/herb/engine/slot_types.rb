# frozen_string_literal: true

module Herb
  class Engine
    # What kinds of slot there are, and which of them behave the same way.
    #
    # Everything that asks a slot what it can do asks here, so the marker writer, the dependency
    # map, the state compiler and the subtree compiler all draw the same lines.
    module SlotTypes
      # A slot whose markup depends on which way the template branched.
      STRUCTURAL = [:conditional, :collection, :block].freeze #: Array[Symbol]

      # A slot that stands for the whole value of an attribute, or for one word of it.
      ATTRIBUTE_VALUES = [:attribute, :attribute_interpolation].freeze #: Array[Symbol]

      # Every kind of slot that is marked on the element it belongs to instead of by a comment pair.
      ELEMENT_ANCHORED = [*ATTRIBUTE_VALUES, :boolean_attribute, :element, :raw_text].freeze #: Array[Symbol]

      # A slot a `data-herb-name` can name.
      NAMEABLE = [:child, :collection, :conditional, :block].freeze #: Array[Symbol]

      # A slot that renders a value, which is what a state can be read into.
      VALUED = [:child, :attribute, :attribute_interpolation, :element, :raw_text].freeze #: Array[Symbol]

      class << self
        #: (Symbol) -> bool
        def structural?(type) = STRUCTURAL.include?(type)

        #: (Symbol) -> bool
        def attribute_value?(type) = ATTRIBUTE_VALUES.include?(type)

        #: (Symbol) -> bool
        def attribute?(type) = attribute_value?(type) || type == :boolean_attribute

        #: (Symbol) -> bool
        def element_anchored?(type) = ELEMENT_ANCHORED.include?(type)

        #: (Symbol) -> bool
        def nameable?(type) = NAMEABLE.include?(type)

        #: (Symbol) -> bool
        def valued?(type) = VALUED.include?(type)
      end
    end
  end
end
