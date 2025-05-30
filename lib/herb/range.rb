# frozen_string_literal: true
# typed: true

module Herb
  class Range
    attr_reader :from #: Integer
    attr_reader :to #: Integer

    #: (from: Integer, to: Integer) -> void
    def initialize(from, to)
      @from = from
      @to = to
    end

    #: (from: Integer, to: Integer) -> Range
    def self.[](from, to)
      new(from, to)
    end

    #: (from: Integer, to: Integer) -> Range
    def self.from(from, to)
      new(from, to)
    end

    #: () -> [Integer, Integer]
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
