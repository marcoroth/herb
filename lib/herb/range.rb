# frozen_string_literal: true
# typed: true

module Herb
  #: type serialized_range = [Integer, Integer]
  class Range
    attr_reader :from #: Integer
    attr_reader :to #: Integer

    #: (Integer, Integer) -> void
    def initialize(from, to)
      @from = from
      @to = to
    end

    #: (Integer, Integer) -> Range
    def self.[](from, to)
      new(from, to)
    end

    #: (Integer, Integer) -> Range
    def self.from(from, to)
      new(from, to)
    end

    #: () -> serialized_range
    def to_a
      [from, to] #: Herb::serialized_range
    end

    #: (?untyped) -> String
    def to_json(state = nil)
      to_a.to_json(state)
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
