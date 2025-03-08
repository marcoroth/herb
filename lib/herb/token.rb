# frozen_string_literal: true

module Herb
  class Token
    attr_reader :value, :range, :start_position, :end_position, :type

    # TODO: use a single location
    def initialize(value, range, start_position, end_position, type)
      @value = value
      @range = range
      @start_position = start_position
      @end_position = end_position
      @type = type
    end

    def to_hash
      {
        value: value,
        range: range&.to_a,
        start_position: start_position&.to_hash,
        end_position: end_position&.to_hash,
        type: type,
      }
    end

    def to_json(*args)
      to_hash.to_json(*args)
    end

    def tree_inspect
      # TODO: use a single location
      %("#{value}" (location: #{start_position.tree_inspect}-#{end_position.tree_inspect}))
    end

    def inspect
      %(#<Herb::Token type="#{type}" value=#{value.inspect} range=#{range.tree_inspect} start=#{start_position.tree_inspect} end=#{end_position.tree_inspect}>)
    end
  end
end
