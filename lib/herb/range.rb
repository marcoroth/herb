# frozen_string_literal: true
# typed: true

module Herb
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

    #: (Array|Hash|nil) -> Range
    def self.from_hash(data)
      return if data.nil?

      case data
      when Array
        from = data[0].is_a?(Numeric) ? data[0].to_i : 0
        to = data[1].is_a?(Numeric) ? data[1].to_i : 0

        new(from, to)
      when Hash
        from_value = data[:start] || data["start"] || data[:from] || data["from"] || 0
        to_value = data[:end] || data["end"] || data[:to] || data["to"] || 0

        from = from_value.is_a?(Numeric) ? from_value.to_i : 0
        to = to_value.is_a?(Numeric) ? to_value.to_i : 0

        new(from, to)
      end
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
