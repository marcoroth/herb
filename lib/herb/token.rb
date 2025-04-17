# frozen_string_literal: true

module Herb
  class Token
    attr_reader :value, :range, :location, :type

    def initialize(value, range, location, type)
      @value = value
      @range = range
      @location = location
      @type = type
    end

    def to_hash
      {
        value: value,
        range: range&.to_a,
        location: location&.to_hash,
        type: type,
      }
    end

    def to_json(*args)
      to_hash.to_json(*args)
    end

    def tree_inspect
      %("#{value.force_encoding("utf-8")}" #{location.tree_inspect})
    end

    def value_inspect
      if type == "TOKEN_EOF"
        "<EOF>".inspect
      else
        value.inspect
      end
    end

    def inspect
      %(#<Herb::Token type="#{type}" value=#{value_inspect} range=#{range.tree_inspect} start=#{location.start.tree_inspect} end=#{location.end.tree_inspect}>)
    end
  end
end
