# frozen_string_literal: true

module Herb
  module Analysis
    class RubyLocalsIndex
      class OffsetTable
        # @rbs!
        #   @line_starts: Array[Integer]

        #: (String) -> void
        def initialize(source)
          @line_starts = [0]

          source.each_byte.with_index do |byte, index|
            @line_starts << (index + 1) if byte == 0x0A
          end
        end

        #: (NamedReference) -> Herb::Location
        def location_for(reference)
          start_line, start_column = position_at(reference.start_offset)
          end_line, end_column = position_at(reference.start_offset + reference.length)

          Location.from(start_line, start_column, end_line, end_column)
        end

        #: (Integer) -> [Integer, Integer]
        def position_at(offset)
          following = @line_starts.bsearch_index { |start| start > offset }
          index = following ? following - 1 : @line_starts.length - 1
          start = @line_starts[index] || 0

          [index + 1, offset - start]
        end
      end
    end
  end
end
