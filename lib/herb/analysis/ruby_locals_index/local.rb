# frozen_string_literal: true

module Herb
  module Analysis
    class RubyLocalsIndex
      class Local
        attr_reader :name #: String
        attr_reader :declaration #: Herb::Location
        attr_reader :usages #: Array[Herb::Location]

        #: (String, Herb::Location, Array[Herb::Location]) -> void
        def initialize(name, declaration, usages)
          @name = name
          @declaration = declaration
          @usages = usages
        end

        #: () -> Array[Herb::Location]
        def locations
          [declaration, *usages]
        end
      end
    end
  end
end
