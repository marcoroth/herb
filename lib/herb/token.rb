# frozen_string_literal: true
# typed: true

module Herb
  class Token
    #: String
    attr_reader :value

    #: Range
    attr_reader :range

    #: Location
    attr_reader :location

    #: String
    attr_reader :type

    #: (String, Range, Location, String) -> void
    def initialize(value, range, location, type)
      @value = value
      @range = range
      @location = location
      @type = type
    end

    #: () -> { value: String, range: [Integer, Integer], location: { start: { line: Integer, column: Integer }, end: { line: Integer, column: Integer } }, type: String }
    def to_hash
      {
        value: value,
        range: range.to_a,
        location: location.to_hash,
        type: type,
      }
    end

    #: (?untyped) -> String
    def to_json(state = nil)
      to_hash.to_json(state)
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
