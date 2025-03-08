# frozen_string_literal: true

module Herb
  class Location
    attr_reader :start, :end

    def initialize(start_position, end_position)
      @start = start_position
      @end = end_position
    end

    def self.from(start_line, start_column, end_line, end_column)
      new(
        Position.new(start_line, start_column),
        Position.new(end_line, end_column)
      )
    end

    def self.[](...)
      from(...)
    end

    def to_hash
      {
        start: start,
        end: self.end,
      }
    end

    def to_json(*args)
      to_hash.to_json(*args)
    end

    def tree_inspect
      %((location: #{start.tree_inspect}-#{self.end.tree_inspect}))
    end

    def inspect
      %(#<Herb::Location #{tree_inspect}>)
    end
  end
end
