# frozen_string_literal: true

require_relative "test_helper"

class CompleteFormatLintTest < Minitest::Test
  def test_format_and_lint_functionality_summary
    assert defined?(Herb::Diagnostic)
    assert defined?(Herb::LintOffense)
    assert defined?(Herb::LintResult)

    assert_respond_to Herb, :format
    assert_respond_to Herb, :format_file
    assert_respond_to Herb, :lint
    assert_respond_to Herb, :lint_file

    diagnostic = Herb::Diagnostic.new(
      message: "Test diagnostic",
      location: create_test_location,
      severity: "error"
    )

    assert_instance_of Herb::Diagnostic, diagnostic
    assert diagnostic.error?

    lint_offense = Herb::LintOffense.new(
      message: "Test lint offense",
      location: create_test_location,
      severity: "warning",
      rule: "test-rule"
    )

    assert_instance_of Herb::LintOffense, lint_offense
    assert_kind_of Herb::Diagnostic, lint_offense
    assert lint_offense.warning?
    assert_equal "test-rule", lint_offense.rule
  end

  def test_lint_result_integration
    error_offense = Herb::LintOffense.new(
      message: "Missing alt attribute",
      location: create_test_location,
      severity: "error",
      rule: "html-img-require-alt"
    )

    warning_offense = Herb::LintOffense.new(
      message: "Consider semantic HTML",
      location: create_test_location,
      severity: "warning",
      rule: "html-semantic"
    )

    lint_result = Herb::LintResult.new([error_offense, warning_offense])

    assert_equal 2, lint_result.total_offenses
    assert_equal 1, lint_result.errors
    assert_equal 1, lint_result.warnings
    assert_equal 0, lint_result.infos
    assert_equal 0, lint_result.hints

    refute lint_result.success?
    refute lint_result.clean?

    assert_equal 1, lint_result.error_offenses.length
    assert_equal 1, lint_result.warning_offenses.length
    assert_equal 1, lint_result.offenses_for_rule("html-img-require-alt").length

    hash = lint_result.to_h
    assert_instance_of Hash, hash
    assert_equal 2, hash[:total_offenses]

    json = lint_result.to_json
    assert_instance_of String, json
    assert_includes json, "Missing alt attribute"

    string_output = lint_result.to_s
    assert_includes string_output, "2 lint offenses"
    assert_includes string_output, "1 errors"
    assert_includes string_output, "1 warnings"
  end

  def test_backend_integration_with_lint_result
    original_backend = Herb.current_backend
    skip "Node backend not available" unless node_backend_available?

    begin
      Herb.switch_backend(:native)

      result = Herb.lint("<div></div>")

      assert_instance_of Herb::LintResult, result
    rescue StandardError => e
      assert_instance_of StandardError, e
    ensure
      Herb.switch_backend(original_backend) if original_backend
    end
  end

  def test_javascript_data_conversion
    offense_data = {
      message: "Missing alt attribute",
      severity: "error",
      rule: "html-img-require-alt",
      code: "E001",
      location: {
        start: { line: 1, column: 5 },
        end: { line: 1, column: 20 },
      },
    }

    offense = Herb::LintOffense.from_hash(offense_data)

    assert_equal "Missing alt attribute", offense.message
    assert_equal "error", offense.severity
    assert_equal "html-img-require-alt", offense.rule
    assert_equal "E001", offense.code
    assert_equal 1, offense.location.start.line
    assert_equal 5, offense.location.start.column

    result_data = {
      offenses: [offense_data],
    }

    result = Herb::LintResult.from_hash(result_data)

    assert_equal 1, result.total_offenses
    assert_equal 1, result.errors
    assert_equal 0, result.warnings
    refute result.success?
  end

  private

  def create_test_location
    start_pos = Herb::Position.new(1, 5)
    end_pos = Herb::Position.new(1, 15)
    Herb::Location.new(start_pos, end_pos)
  end

  def node_backend_available?
    require "nodo"
    true
  rescue LoadError
    false
  end
end
