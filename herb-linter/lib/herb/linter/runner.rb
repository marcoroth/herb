# frozen_string_literal: true
# typed: true

module Herb
  class Linter
    class Runner
      attr_reader :config #: Hash[String, untyped]?
      attr_reader :custom_rules #: Array[Rule]

      #: (?config: Hash[String, untyped]?, ?custom_rules: Array[Rule]) -> void
      def initialize(config: nil, custom_rules: [])
        @config = config
        @custom_rules = custom_rules
      end

      #: (String, ?file_name: String?) -> LintResult
      def lint(source, file_name: nil)
        result = lint_with_backend(source, file_name: file_name)

        if custom_rules.any?
          custom_result = lint_with_custom_rules(source, file_name: file_name)
          result = result.merge(custom_result)
        end

        result
      end

      #: (String, ?file_name: String?) -> LintResult
      def lint_file(path, file_name: nil)
        source = File.read(path)

        lint(source, file_name: file_name || path)
      end

      #: () -> bool
      def backend_available?
        Herb::Linter::Backend.available?
      rescue NameError
        false
      end

      #: () -> Integer
      def rule_count
        backend_count = backend_available? ? Herb::Linter::Backend.rule_count : 0

        backend_count + custom_rules.length
      end

      #: () -> Array[String]
      def rule_names
        backend_names = backend_available? ? Herb::Linter::Backend.rule_names : []

        backend_names + custom_rules.map(&:name)
      end

      private

      #: (String, ?file_name: String?) -> LintResult
      def lint_with_backend(source, file_name: nil)
        unless backend_available?
          return LintResult.new([], 0, 0, 0, 0, 0)
        end

        config_json = config ? JSON.generate(config) : nil
        hash = Herb::Linter::Backend.lint(source, config_json, file_name)

        return LintResult.new([], 0, 0, 0, 0, 0) if hash.nil?

        LintResult.from(hash)
      end

      #: (String, ?file_name: String?) -> LintResult
      def lint_with_custom_rules(source, file_name: nil)
        parse_result = Herb.parse(source)
        context = { file_name: file_name }

        offenses = []

        custom_rules.each do |rule|
          next unless rule.enabled?

          rule_offenses = rule.check(parse_result, context)

          offenses.concat(rule_offenses)
        end

        errors = offenses.count(&:error?)
        warnings = offenses.count(&:warning?)
        info_count = offenses.count(&:info?)
        hints = offenses.count(&:hint?)

        LintResult.new(offenses, errors, warnings, info_count, hints, 0)
      end
    end
  end
end
