# frozen_string_literal: true

module ERBX
  class Location
    attr_reader :line, :column

    def initialize(line, column)
      @line = line
      @column = column
    end

    def to_hash
      { line: line, column: column }
    end

    def to_json(*args)
      to_hash.to_json(*args)
    end

    def tree_inspect
      "(#{line}:#{column})"
    end

    def inspect
      %(#<ERBX::Location #{tree_inspect}>)
    end
  end
end
