# frozen_string_literal: true
# typed: true

module Herb
  class Location
    attr_reader :start #: Position
    attr_reader :end #: Position

    #: (Position, Position) -> void
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

    #: (Hash[untyped, untyped]|nil) -> Location
    def self.from_hash(hash_data)
      return if hash_data.nil?

      start_data = hash_data[:start] || hash_data["start"]
      end_data = hash_data[:end] || hash_data["end"]

      start_pos = Position.from_hash(start_data)
      end_pos = Position.from_hash(end_data)

      new(start_pos, end_pos)
    end

    #: () -> serialized_location
    def to_hash
      {
        start: start&.to_hash,
        end: self.end&.to_hash,
      } #: Herb::serialized_location
    end

    #: () -> serialized_location
    def to_h
      to_hash
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
