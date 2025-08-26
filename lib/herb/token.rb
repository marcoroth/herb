# frozen_string_literal: true
# typed: true

module Herb
  class Token
    attr_reader :value #: String
    attr_reader :range #: Range
    attr_reader :location #: Location
    attr_reader :type #: String

    #: (String, Range, Location, String) -> void
    def initialize(value, range, location, type)
      @value = value
      @range = range
      @location = location
      @type = type
    end

    #: () -> serialized_token
    def to_hash
      {
        value: value,
        range: range&.to_a,
        location: location&.to_hash,
        type: type,
      } #: Herb::serialized_token
    end

    #: (Hash) -> Token
    def self.from_hash(data)
      return if data.nil?

      value = data[:value] || data["value"] || ""
      type = data[:type] || data["type"] || ""

      range = Herb::Range.from_hash(data[:range] || data["range"])
      location = Location.from_hash(data[:location] || data["location"])

      new(value, range, location, type)
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
