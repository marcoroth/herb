# frozen_string_literal: true

module ERBX
  class Range
    attr_reader :start_position, :end_position

    def initialize(start_position, end_position)
      @start_position = start_position
      @end_position = end_position
    end

    def to_hash
      { start_position: start_position, end_position: end_position }
    end

    def to_json(*args)
      to_hash.to_json(*args)
    end
  end
end
