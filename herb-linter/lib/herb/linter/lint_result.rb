# frozen_string_literal: true
# typed: true

module Herb
  class Linter
    class LintResult
      attr_reader :offenses #: Array[Offense]
      attr_reader :errors #: Integer
      attr_reader :warnings #: Integer
      attr_reader :info #: Integer
      attr_reader :hints #: Integer
      attr_reader :ignored #: Integer

      #: (Array[Offense], Integer, Integer, Integer, Integer, Integer) -> void
      def initialize(offenses, errors, warnings, info, hints, ignored)
        @offenses = offenses
        @errors = errors
        @warnings = warnings
        @info = info
        @hints = hints
        @ignored = ignored
      end

      #: (Hash[String, untyped]) -> LintResult
      def self.from(hash)
        offenses = (hash["offenses"] || []).map { |offense| Offense.from(offense) }

        new(
          offenses,
          hash["errors"] || 0,
          hash["warnings"] || 0,
          hash["info"] || 0,
          hash["hints"] || 0,
          hash["ignored"] || 0
        )
      end

      #: () -> Integer
      def offense_count
        offenses.length
      end

      #: () -> bool
      def clean?
        offenses.empty?
      end

      #: (LintResult) -> LintResult
      def merge(other)
        LintResult.new(
          offenses + other.offenses,
          errors + other.errors,
          warnings + other.warnings,
          info + other.info,
          hints + other.hints,
          ignored + other.ignored
        )
      end

      #: () -> Hash[Symbol, untyped]
      def to_hash
        {
          offenses: offenses.map(&:to_hash),
          errors: errors,
          warnings: warnings,
          info: info,
          hints: hints,
          ignored: ignored,
        }
      end

      #: (?untyped) -> String
      def to_json(state = nil)
        to_hash.to_json(state)
      end

      #: () -> String
      def inspect
        %(#<Herb::Linter::LintResult offenses=#{offense_count} errors=#{errors} warnings=#{warnings} info=#{info} hints=#{hints}>)
      end
    end
  end
end
