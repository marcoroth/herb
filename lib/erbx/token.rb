# frozen_string_literal: true

module ERBX
  class Token
    attr_reader :value, :range, :start, :end, :type

    def initialize(value, range, start, end_loc, type)
      @value = value
      @range = range
      @start = start
      @end = end_loc
      @type = type
    end

    def to_hash
      {
        value: value,
        range: range&.to_hash,
        start: start&.to_hash,
        end: self.end&.to_hash,
        type: type
      }
    end

    def to_json(*args)
      to_hash.to_json(*args)
    end

    def inspect
      %(#<ERBX::Token type="#{type}" value="#{value}" range=[#{range.start_position}, #{range.start_position}] start=#{start.line}:#{start.column} end=#{self.end.line}:#{self.end.column}>)
    end
  end
end
