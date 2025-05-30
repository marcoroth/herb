# frozen_string_literal: true
# typed: true

module Herb
  class Token
    attr_reader :value #: String
    attr_reader :range #: Range
    attr_reader :location #: Location
    attr_reader :type #: String

    #: (value: String, range: Range, location: Location, type: String) -> void
    def initialize(value, range, location, type)
      @value = value
      @range = range
      @location = location
      @type = type
    end

    #: () -> { value: String, range: Array[Position]?, location: Hash[Symbol, Position]?, type: String }
    def to_hash
      {
        value: value,
        range: range&.to_a,
        location: location&.to_hash,
        type: type,
      }
    end

    #: (?untyped, ?untyped) -> String
    def to_json(state = nil, options = nil)
      to_hash.to_json(state, options)
    end

    #: () -> String
    def tree_inspect
      %("#{value.force_encoding("utf-8")}" #{location.tree_inspect})
    end

    #: () -> String
    def value_inspect
      if type == "TOKEN_EOF"
        "<EOF>".inspect
      else
        value.inspect
      end
    end

    #: () -> String
    def inspect
      %(#<Herb::Token type="#{type}" value=#{value_inspect} range=#{range.tree_inspect} start=#{location.start.tree_inspect} end=#{location.end.tree_inspect}>)
    end
  end
end
