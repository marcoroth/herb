# frozen_string_literal: true
# typed: true

module Herb
  #: type serialized_token = {
  #|  value: String,
  #|  range: serialized_range?,
  #|  location: serialized_location?,
  #|  type: String
  #| }
  class Token
    include Colors

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
      }
    end

    #: (?untyped) -> String
    def to_json(state = nil)
      to_hash.to_json(state)
    end

    #: () -> String
    def tree_inspect
      "#{green("\"#{value.force_encoding("utf-8")}\"")} #{dimmed("(location: #{location.tree_inspect})")}"
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
      white("[") + cyan(range.from.to_s) + white(", ") + cyan(range.to.to_s) + white("]")
    end

    #: (Position) -> String
    def colorize_position(position)
      white("(") + cyan(position.line.to_s) + white(":") + cyan(position.column.to_s) + white(")")
    end

    #: () -> String
    def inspect
      "#{white("#<")}#{bold(yellow("Herb::Token"))} #{white("type=")}#{bright_magenta("\"#{type}\"")} #{white("value=")}#{green(value_inspect)} #{white("range=")}#{colorize_range} #{white("start=")}#{colorize_position(location.start)} #{white("end=")}#{colorize_position(location.end)}#{white(">")}"
    end
  end
end
