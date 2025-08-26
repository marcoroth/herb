# frozen_string_literal: true
# typed: true

module Herb
  class Position
    attr_reader :line #: Integer
    attr_reader :column #: Integer

    #: (Integer, Integer) -> void
    def initialize(line, column)
      @line = line
      @column = column
    end

    #: (Integer, Integer) -> Position
    def self.[](line, column)
      new(line, column)
    end

    #: (Integer, Integer) -> Position
    def self.from(line, column)
      new(line, column)
    end

    #: (Hash[untyped, untyped]|nil) -> Position
    def self.from_hash(hash_data)
      return if hash_data.nil?

      line = hash_data[:line] || hash_data["line"] || 1
      column = hash_data[:column] || hash_data["column"] || 0

      line = line.is_a?(Numeric) ? line.to_i : 1
      column = column.is_a?(Numeric) ? column.to_i : 0

      new(line, column)
    end

    #: () -> serialized_position
    def to_hash
      { line: line, column: column } #: Herb::serialized_position
    end

    #: () -> serialized_position
    def to_h
      to_hash
    end

    #: (?untyped) -> String
    def to_json(state = nil)
      to_hash.to_json(state)
    end

    #: () -> String
    def tree_inspect
      "(#{line}:#{column})"
    end

    #: () -> String
    def inspect
      %(#<Herb::Position #{tree_inspect}>)
    end
  end
end
