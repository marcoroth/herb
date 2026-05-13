# frozen_string_literal: true
# typed: true

module Herb
  class Linter
    class Offense < Herb::Diagnostic
      attr_reader :rule #: String

      #: (String, String, String, String, String, Location) -> void
      def initialize(rule, code, source, message, severity, location)
        @rule = rule
        super(message, location, severity, code: code, source: source)
      end

      #: (Hash[String, untyped]) -> Offense
      def self.from(hash)
        location_hash = hash["location"]

        location = Herb::Location.from(
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

      #: () -> Hash[Symbol, untyped]
      def to_hash
        super.merge(rule: rule)
      end

      #: () -> String
      def inspect
        %(#<Herb::Linter::Offense rule=#{rule.inspect} severity=#{severity.inspect} message=#{message.inspect}>)
      end
    end
  end
end
