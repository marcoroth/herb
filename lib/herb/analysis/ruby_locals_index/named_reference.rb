# frozen_string_literal: true

module Herb
  module Analysis
    class RubyLocalsIndex
      class NamedReference
        attr_reader :name #: String
        attr_reader :start_offset #: Integer
        attr_reader :length #: Integer

        #: (String, Integer, Integer) -> void
        def initialize(name, start_offset, length)
          @name = name
          @start_offset = start_offset
          @length = length
        end
      end
    end
  end
end
