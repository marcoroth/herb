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

    #: (Array[untyped]|Hash[untyped, untyped]|nil) -> Range?
    def self.from_hash(data)
      return nil if data.nil?

      case data
      when Array
        from = if data[0].is_a?(Integer)
                 data[0]
               else
                 (data[0].respond_to?(:to_i) ? data[0].to_i : 0)
               end
        to = if data[1].is_a?(Integer)
               data[1]
             else
               (data[1].respond_to?(:to_i) ? data[1].to_i : 0)
             end

        new(from, to)
      when Hash
        from_value = data[:start] || data["start"] || data[:from] || data["from"] || 0
        to_value = data[:end] || data["end"] || data[:to] || data["to"] || 0

        from = if from_value.is_a?(Integer)
                 from_value
               else
                 (from_value.respond_to?(:to_i) ? from_value.to_i : 0)
               end
        to = if to_value.is_a?(Integer)
               to_value
             else
               (to_value.respond_to?(:to_i) ? to_value.to_i : 0)
             end

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
