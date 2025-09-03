# frozen_string_literal: true
# typed: true

module Herb
  #: type serialized_location = { start: Herb::Position, end: Herb::Position }
  class Location
    #: Herb::Position
    attr_reader :start
    #: Herb::Position
    attr_reader :end

    #: (Herb::Position, Herb::Position) -> void
    def initialize(start_position, end_position)
      @start = start_position
      @end = end_position
    end

    #: (Integer, Integer, Integer, Integer) -> Location
    def self.from(start_line, start_column, end_line, end_column)
      new(
        Position.new(start_line, start_column),
        Position.new(end_line, end_column)
      )
    end

    #: (Integer, Integer, Integer, Integer) -> Location
    def self.[](start_line, start_column, end_line, end_column)
      from(start_line, start_column, end_line, end_column)
    end

    #: () -> (serialized_location)
    def to_hash
      {
        start: start,
        end: self.end,
      }
    end

    #: (?untyped) -> String
    def to_json(state = nil)
      to_hash.to_json(state)
    end

    #: () -> String
    def tree_inspect
      %((location: #{start.tree_inspect}-#{self.end.tree_inspect}))
    end

    #: () -> String
    def inspect
      %(#<Herb::Location #{tree_inspect}>)
    end
  end
end
