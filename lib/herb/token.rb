# frozen_string_literal: true

module Herb
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
        range: range&.to_a,
        start_location: start_location&.to_hash,
        end_location: end_location&.to_hash,
        type: type,
      }
    end

    def to_json(*args)
      to_hash.to_json(*args)
    end

    def tree_inspect
      %("#{value}" (location: #{start_location.tree_inspect}-#{end_location.tree_inspect}))
    end

    def inspect
      %(#<Herb::Token type="#{type}" value=#{value.inspect} range=#{range.tree_inspect} start=#{start_location.tree_inspect} end=#{end_location.tree_inspect}>)
    end
  end
end
