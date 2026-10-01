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
    attr_reader :type #: String

    #: (String | Symbol, String, ?location: Location, ?range: Range) -> Token
    def self.from(type, value, location: Location.zero, range: Range.zero)
      new(value.dup, range, location, type.to_s)
    end

    #: (String, Range, Location, String) -> void
    def initialize(value, range, location, type)
      @value = value
      @range = range
      @location = location
      @type = type
    end

    # `@range` and `@location` may not be set yet when a token is constructed by the C
    # extension: in that case the raw numeric components (`@range_from`, `@range_to`,
    # `@loc_start_line`, `@loc_start_column`, `@loc_end_line`, `@loc_end_column`) are set
    # directly on the ivars instead (or left unset entirely when `track_locations` is
    # disabled), and the `Range`/`Location` (and, transitively, `Position`) objects are
    # only materialized here on first access.

    #: () -> Range?
    def range
      return @range if defined?(@range)
      return nil unless defined?(@range_from)

      @range = Range.new(@range_from, @range_to)
    end

    #: () -> Location?
    def location
      return @location if defined?(@location)
      return nil unless defined?(@loc_start_line)

      @location = Location.from(@loc_start_line, @loc_start_column, @loc_end_line, @loc_end_column)
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
      current_location = location
      location_inspect = current_location ? current_location.tree_inspect : "∅"

      "#{green("\"#{value.force_encoding("utf-8")}\"")} #{dimmed("(location: #{location_inspect})")}"
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
      current_range = range
      return "∅" unless current_range

      white("[") + cyan(current_range.from.to_s) + white(", ") + cyan(current_range.to.to_s) + white("]")
    end

    #: (Position?) -> String
    def colorize_position(position)
      return "∅" unless position

      white("(") + cyan(position.line.to_s) + white(":") + cyan(position.column.to_s) + white(")")
    end

    #: () -> String
    def inspect
      "#{white("#<")}#{bold(yellow("Herb::Token"))} #{white("type=")}#{bright_magenta("\"#{type}\"")} #{white("value=")}#{green(value_inspect)} #{white("range=")}#{colorize_range} #{white("start=")}#{colorize_position(location&.start)} #{white("end=")}#{colorize_position(location&.end)}#{white(">")}"
    end
  end
end
