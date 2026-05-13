# frozen_string_literal: true

require "test_helper"

class HerbLinterTest < Maxitest::Test
  def test_version
    refute_nil Herb::Linter::VERSION
  end

  def test_runner_lint
    runner = Herb::Linter::Runner.new
    result = runner.lint("<div></div>")

    assert_instance_of Herb::Linter::LintResult, result
    assert_respond_to result, :offenses
    assert_respond_to result, :errors
    assert_respond_to result, :clean?
  end

  def test_lint_result_merge
    result_a = Herb::Linter::LintResult.new([], 1, 2, 0, 0, 0)
    result_b = Herb::Linter::LintResult.new([], 3, 0, 1, 0, 0)

    merged = result_a.merge(result_b)

    assert_equal 4, merged.errors
    assert_equal 2, merged.warnings
    assert_equal 1, merged.info
  end

  def test_custom_rule
    rule = Class.new(Herb::Linter::Rule) do
      def name = "custom/test-rule"
      def severity = :warning

      def check(parse_result, _context = {})
        [offense("Test offense", parse_result.value.location)]
      end
    end.new

    runner = Herb::Linter::Runner.new(custom_rules: [rule])
    result = runner.lint("<div></div>")

    assert_equal 1, result.offense_count
    assert_equal "custom/test-rule", result.offenses.first.rule
    assert_equal "warning", result.offenses.first.severity
  end
end
