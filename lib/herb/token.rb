# frozen_string_literal: true
# typed: true

module Herb
  class Token
    using Colors

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

    #: (?untyped) -> String
    def to_json(state = nil)
      to_hash.to_json(state)
    end

    #: () -> String
    def tree_inspect
      "#{"\"#{value.force_encoding("utf-8")}\"".green} #{"(location: #{location.tree_inspect})".dimmed}"
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
    def colorize_range
      "[".white + range.from.to_s.cyan + ",".white + " ".white + range.to.to_s.cyan + "]".white
    end

    #: (Position) -> String
    def colorize_position(pos)
      "(".white + pos.line.to_s.cyan + ":".white + pos.column.to_s.cyan + ")".white
    end

    #: () -> String
    def inspect
      "#{"#<".white}#{"Herb::Token".yellow.bold} #{"type=".white}#{"\"#{type}\"".bright_magenta} #{"value=".white}#{value_inspect.green} #{"range=".white}#{colorize_range} #{"start=".white}#{colorize_position(location.start)} #{"end=".white}#{colorize_position(location.end)}#{">".white}"
    end
  end
end
