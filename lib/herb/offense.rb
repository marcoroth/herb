# frozen_string_literal: true
# typed: true

module Herb
  class Offense
    attr_reader :rule #: String
    attr_reader :code #: String
    attr_reader :source #: String
    attr_reader :message #: String
    attr_reader :severity #: String
    attr_reader :location #: Location

    #: (String, String, String, String, String, Location) -> void
    def initialize(rule, code, source, message, severity, location)
      @rule = rule
      @code = code
      @source = source
      @message = message
      @severity = severity
      @location = location
    end

    #: (Hash[String, untyped]) -> Offense
    def self.from(hash)
      location_hash = hash["location"]

      location = Location.from(
        location_hash["start"]["line"],
        location_hash["start"]["column"],
        location_hash["end"]["line"],
        location_hash["end"]["column"]
      )

      new(
        hash["rule"],
        hash["code"],
        hash["source"],
        hash["message"],
        hash["severity"],
        location
      )
    end

    #: () -> bool
    def error?
      severity == "error"
    end

    #: () -> bool
    def warning?
      severity == "warning"
    end

    #: () -> bool
    def info?
      severity == "info"
    end

    #: () -> bool
    def hint?
      severity == "hint"
    end

    #: () -> Hash[Symbol, untyped]
    def to_hash
      {
        rule: rule,
        code: code,
        source: source,
        message: message,
        severity: severity,
        location: location.to_hash
      }
    end

    #: (?untyped) -> String
    def to_json(state = nil)
      to_hash.to_json(state)
    end

    #: () -> String
    def inspect
      %(#<Herb::Offense rule=#{rule.inspect} severity=#{severity.inspect} message=#{message.inspect} location=#{location.tree_inspect}>)
    end
  end
end
