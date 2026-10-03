# frozen_string_literal: true

module Herb
  class Engine
    module Slots
      # What kinds of slot there are, and which of them behave the same way.
      #
      # Everything that asks a slot what it can do asks here, so the marker writer, the dependency
      # map, the state compiler and the subtree compiler all draw the same lines.
      #
      module Types
        STRUCTURAL = [:conditional, :collection, :keyed, :block].freeze #: Array[Symbol]
        ATTRIBUTE_VALUES = [:attribute, :attribute_interpolation].freeze #: Array[Symbol]
        ELEMENT_ANCHORED = [*ATTRIBUTE_VALUES, :boolean_attribute, :element, :raw_text, :raw_text_interpolation].freeze #: Array[Symbol]
        NAMEABLE = [:child, :collection, :keyed, :conditional, :block].freeze #: Array[Symbol]
        VALUED = [:child, :attribute, :attribute_interpolation, :element, :raw_text, :raw_text_interpolation].freeze #: Array[Symbol]
        INTERPOLATED = [:attribute_interpolation, :raw_text_interpolation].freeze #: Array[Symbol]

        #: (Symbol) -> bool
        def self.structural?(type) = STRUCTURAL.include?(type)

        #: (Symbol) -> bool
        def self.attribute_value?(type) = ATTRIBUTE_VALUES.include?(type)

        #: (Symbol) -> bool
        def self.attribute?(type) = attribute_value?(type) || type == :boolean_attribute

        #: (Symbol) -> bool
        def self.element_anchored?(type) = ELEMENT_ANCHORED.include?(type)

        #: (Symbol) -> bool
        def self.nameable?(type) = NAMEABLE.include?(type)

        #: (Symbol) -> bool
        def self.valued?(type) = VALUED.include?(type)

        #: (Symbol) -> bool
        def self.interpolated?(type) = INTERPOLATED.include?(type)
      end
    end
  end
end
