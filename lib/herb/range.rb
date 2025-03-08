# frozen_string_literal: true

module Herb
  class Range
    attr_reader :from, :to

    def initialize(from, to)
      @from = from
      @to = to
    end

    def self.[](...)
      new(...)
    end

    def self.from(...)
      new(...)
    end

    def to_a
      [from, to]
    end

    def to_json(*args)
      to_a.to_json(*args)
    end

    def tree_inspect
      to_a.to_s
    end

    def inspect
      %(#<Herb::Range #{to_a}>)
    end

    def to_s
      inspect
    end
  end
end
