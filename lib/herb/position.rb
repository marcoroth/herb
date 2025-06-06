# frozen_string_literal: true
# typed: true

module Herb
  class Position
    #: Integer
    attr_reader :line

    #: Integer
    attr_reader :column

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

    #: () -> { line: Integer, column: Integer }
    def to_hash
      { line: line, column: column }
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
