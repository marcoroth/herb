# frozen_string_literal: true

module ERBX
  class Token
    attr_reader :value, :range, :start_location, :end_location, :type

    def initialize(value, range, start_location, end_location, type)
      @value = value
      @range = range
      @start_location = start_location
      @end_location = end_location
      @type = type
    end

    def to_hash
      {
        value: value,
        range: range&.to_hash,
        start_location: start_location&.to_hash,
        end_location: end_location&.to_hash,
        type: type
      }
    end

    def to_json(*args)
      to_hash.to_json(*args)
    end

    def tree_inspect
      %("#{value}" (location: #{start_location.tree_inspect}-#{end_location.tree_inspect}))
    end

    def inspect
      %(#<ERBX::Token type="#{type}" value="#{value}" range=[#{range.start_position}, #{range.start_position}] start=#{start_location.line}:#{start_location.column} end=#{end_location.line}:#{end_location.column}>)
    end
  end
end
