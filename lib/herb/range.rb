# frozen_string_literal: true
# typed: true

module Herb
  class Range
    attr_reader :from #: Position
    attr_reader :to #: Position

    #: (from: Position, to: Position) -> void
    def initialize(from, to)
      @from = from
      @to = to
    end

    #: (from: Position, to: Position) -> Range
    def self.[](from, to)
      new(from, to)
    end

    #: (from: Position, to: Position) -> Range
    def self.from(from, to)
      new(from, to)
    end

    #: () -> Array[Position]
    def to_a
      [from, to]
    end

    #: (?untyped, ?untyped) -> String
    def to_json(state = nil, options = nil)
      to_a.to_json(state, options)
    end

    #: () -> String
    def tree_inspect
      to_a.to_s
    end

    #: () -> String
    def inspect
      %(#<Herb::Range #{to_a}>)
    end

    #: () -> String
    def to_s
      inspect
    end
  end
end
