# frozen_string_literal: true
# typed: true

module Herb
  class Location
    attr_reader :start #: Position
    attr_reader :end #: Position

    #: (start_position: Position, end_position: Position) -> void
    def initialize(start_position, end_position)
      @start = start_position
      @end = end_position
    end

    #: (start_line: Integer, start_column: Integer, end_line: Integer, end_column: Integer) -> Location
    def self.from(start_line, start_column, end_line, end_column)
      new(
        Position.new(start_line, start_column),
        Position.new(end_line, end_column)
      )
    end

    #: (start_line: Integer, start_column: Integer, end_line: Integer, end_column: Integer) -> Location
    def self.[](start_line, start_column, end_line, end_column)
      from(start_line, start_column, end_line, end_column)
    end

    #: () -> { start: { line: Integer, column: Integer }, end: { line: Integer, column: Integer } }
    def to_hash
      {
        start: start,
        end: self.end,
      }
    end

    #: (?untyped, ?untyped) -> String
    def to_json(state = nil, options = nil)
      to_hash.to_json(state, options)
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
