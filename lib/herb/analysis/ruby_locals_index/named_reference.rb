# frozen_string_literal: true

module Herb
  module Analysis
    class RubyLocalsIndex
      # A name, with where it appears in the source as a byte offset and length,
      # which is how Prism reports it.
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
