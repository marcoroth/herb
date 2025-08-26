# frozen_string_literal: true
# typed: true

# rbs_inline: enabled

require_relative "diagnostic"

module Herb
  class LintOffense < Diagnostic
    attr_reader :rule #: String

    #: (message: String, location: Location, severity: String, rule: String, ?code: String?, ?source: String?) -> void
    def initialize(message:, location:, severity:, rule:, code: nil, source: "linter")
      super(
        message: message,
        location: location,
        severity: severity,
        code: code,
        source: source
      )
      @rule = rule
    end

    #: () -> Hash[Symbol, untyped]
    def to_h
      super.merge(rule: @rule)
    end

    #: () -> String
    def to_s
      parts = [] #: Array[String]

      parts << "[#{@severity.upcase}]" if @severity
      parts << "[#{@rule}]" if @rule
      parts << "[#{@code}]" if @code
      parts << @message
      parts << "at #{@location}" if @location

      parts.join(" ")
    end

    #: (Hash[untyped, untyped]) -> LintOffense
    def self.from_hash(offense_data)
      location = if offense_data[:location]
                   Location.from_hash(offense_data[:location])
                 else
                   Location.new(Position.new(1, 1), Position.new(1, 1))
                 end

      new(
        message: offense_data[:message] || "Unknown lint offense",
        location: location,
        severity: offense_data[:severity] || "error",
        rule: offense_data[:rule] || "unknown",
        code: offense_data[:code],
        source: offense_data[:source] || "linter"
      )
    end
  end
end
