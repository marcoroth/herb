# frozen_string_literal: true
# typed: true

# rbs_inline: enabled

require_relative "lint_offense"

module Herb
  class LintResult
    attr_reader :offenses #: Array[LintOffense]

    #: (?Array[LintOffense | Hash[untyped, untyped]]) -> void
    def initialize(offenses = [])
      @offenses = offenses.map { |offense|
        offense.is_a?(LintOffense) ? offense : LintOffense.from_hash(offense)
      }
    end

    #: () -> Integer
    def errors
      @offenses.count(&:error?)
    end

    #: () -> Integer
    def warnings
      @offenses.count(&:warning?)
    end

    #: () -> Integer
    def infos
      @offenses.count(&:info?)
    end

    #: () -> Integer
    def hints
      @offenses.count(&:hint?)
    end

    #: () -> Integer
    def total_offenses
      @offenses.length
    end

    #: () -> bool
    def success?
      errors.zero?
    end

    #: () -> bool
    def clean?
      @offenses.empty?
    end

    #: (String) -> Array[LintOffense]
    def offenses_by_severity(severity)
      @offenses.select { |offense| offense.severity == severity }
    end

    #: () -> Array[LintOffense]
    def error_offenses
      offenses_by_severity("error")
    end

    #: () -> Array[LintOffense]
    def warning_offenses
      offenses_by_severity("warning")
    end

    #: () -> Array[LintOffense]
    def info_offenses
      offenses_by_severity("info")
    end

    #: () -> Array[LintOffense]
    def hint_offenses
      offenses_by_severity("hint")
    end

    #: (String) -> Array[LintOffense]
    def offenses_for_rule(rule_name)
      @offenses.select { |offense| offense.rule == rule_name }
    end

    #: () -> Hash[Symbol, untyped]
    def to_h
      {
        offenses: @offenses.map(&:to_h),
        errors: errors,
        warnings: warnings,
        infos: infos,
        hints: hints,
        total_offenses: total_offenses,
        success: success?,
        clean: clean?,
      }
    end

    #: (?untyped) -> String
    def to_json(state = nil)
      to_h.to_json(state)
    end

    #: () -> String
    def to_s
      return "✓ No lint offenses found" if clean?

      parts = [] #: Array[String]
      parts << "#{errors} errors" if errors.positive?
      parts << "#{warnings} warnings" if warnings.positive?
      parts << "#{infos} infos" if infos.positive?
      parts << "#{hints} hints" if hints.positive?

      "✗ Found #{total_offenses} lint offenses: #{parts.join(", ")}"
    end

    #: (Hash[untyped, untyped]) -> LintResult
    def self.from_hash(hash_result)
      offenses = (hash_result[:offenses] || hash_result["offenses"] || []).map do |offense_data|
        LintOffense.from_hash(offense_data)
      end

      new(offenses)
    end
  end
end
