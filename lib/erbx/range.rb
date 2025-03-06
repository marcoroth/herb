# frozen_string_literal: true

module ERBX
  class Range
    attr_reader :start_position, :end_position

    def initialize(start_position, end_position)
      @start_position = start_position
      @end_position = end_position
    end

    def to_a
      [start_position, end_position]
    end

    def to_json(*args)
      to_a.to_json(*args)
    end

    def tree_inspect
      to_a.to_s
    end

    def inspect
      %(#<ERBX::Range #{to_a}>)
    end

    def to_s
      inspect
    end
  end
end
