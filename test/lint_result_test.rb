# frozen_string_literal: true

require_relative "test_helper"

class LintResultTest < Minitest::Test
  def setup
    @position = Herb::Position.new(1, 5)
    @location = Herb::Location.new(@position, Herb::Position.new(1, 15))

    @error_offense = Herb::LintOffense.new(
      message: "Missing alt attribute",
      location: @location,
      severity: "error",
      rule: "html-img-require-alt"
    )

    @warning_offense = Herb::LintOffense.new(
      message: "Consider using semantic HTML",
      location: @location,
      severity: "warning",
      rule: "html-semantic-elements"
    )
  end

  def test_diagnostic_creation
    diagnostic = Herb::Diagnostic.new(
      message: "Test message",
      location: @location,
      severity: "error",
      code: "E001",
      source: "test"
    )

    assert_equal "Test message", diagnostic.message
    assert_equal @location, diagnostic.location
    assert_equal "error", diagnostic.severity
    assert_equal "E001", diagnostic.code
    assert_equal "test", diagnostic.source
    assert diagnostic.error?
    refute diagnostic.warning?
  end

  def test_diagnostic_severity_validation
    error = assert_raises(ArgumentError) do
      Herb::Diagnostic.new(
        message: "Test",
        location: @location,
        severity: "invalid"
      )
    end

    assert_includes error.message, "Invalid severity"
    assert_includes error.message, "error, warning, info, hint"
  end

  def test_lint_offense_creation
    offense = Herb::LintOffense.new(
      message: "Test offense",
      location: @location,
      severity: "warning",
      rule: "test-rule"
    )

    assert_equal "Test offense", offense.message
    assert_equal "warning", offense.severity
    assert_equal "test-rule", offense.rule
    assert_equal "linter", offense.source
    assert offense.warning?
  end

  def test_lint_offense_from_hash
    data = {
      message: "Missing alt attribute",
      severity: "error",
      rule: "html-img-require-alt",
      location: {
        start: { line: 1, column: 5 },
        end: { line: 1, column: 15 },
      },
    }

    offense = Herb::LintOffense.from_hash(data)

    assert_equal "Missing alt attribute", offense.message
    assert_equal "error", offense.severity
    assert_equal "html-img-require-alt", offense.rule
    assert_equal 1, offense.location.start.line
    assert_equal 5, offense.location.start.column
  end

  def test_lint_offense_from_hash_with_minimal_data
    data = {
      message: "Test message",
    }

    offense = Herb::LintOffense.from_hash(data)

    assert_equal "Test message", offense.message
    assert_equal "error", offense.severity
    assert_equal "unknown", offense.rule
    assert_equal 1, offense.location.start.line
  end

  def test_lint_result_creation
    result = Herb::LintResult.new([@error_offense, @warning_offense])

    assert_equal 2, result.total_offenses
    assert_equal 1, result.errors
    assert_equal 1, result.warnings
    assert_equal 0, result.infos
    assert_equal 0, result.hints

    refute result.success?
    refute result.clean?
  end

  def test_lint_result_empty
    result = Herb::LintResult.new([])

    assert_equal 0, result.total_offenses
    assert_equal 0, result.errors
    assert_equal 0, result.warnings

    assert result.success?
    assert result.clean?
  end

  def test_lint_result_success_with_warnings
    result = Herb::LintResult.new([@warning_offense])

    assert_equal 1, result.total_offenses
    assert_equal 0, result.errors
    assert_equal 1, result.warnings

    assert result.success?
    refute result.clean?
  end

  def test_lint_result_offense_filtering
    info_offense = Herb::LintOffense.new(
      message: "Info message",
      location: @location,
      severity: "info",
      rule: "info-rule"
    )

    result = Herb::LintResult.new([@error_offense, @warning_offense, info_offense])

    assert_equal 1, result.error_offenses.length
    assert_equal 1, result.warning_offenses.length
    assert_equal 1, result.info_offenses.length
    assert_equal 0, result.hint_offenses.length

    assert_equal @error_offense, result.error_offenses.first
    assert_equal @warning_offense, result.warning_offenses.first
  end

  def test_lint_result_offense_by_rule
    other_error = Herb::LintOffense.new(
      message: "Another error",
      location: @location,
      severity: "error",
      rule: "html-img-require-alt"
    )

    result = Herb::LintResult.new([@error_offense, @warning_offense, other_error])

    img_offenses = result.offenses_for_rule("html-img-require-alt")
    assert_equal 2, img_offenses.length

    semantic_offenses = result.offenses_for_rule("html-semantic-elements")
    assert_equal 1, semantic_offenses.length

    nonexistent_offenses = result.offenses_for_rule("nonexistent-rule")
    assert_equal 0, nonexistent_offenses.length
  end

  def test_lint_result_from_hash
    data = {
      offenses: [
        {
          message: "Missing alt attribute",
          severity: "error",
          rule: "html-img-require-alt",
          location: {
            start: { line: 1, column: 5 },
            end: { line: 1, column: 15 },
          },
        },
        {
          message: "Consider semantic HTML",
          severity: "warning",
          rule: "html-semantic-elements",
        }
      ],
    }

    result = Herb::LintResult.from_hash(data)

    assert_equal 2, result.total_offenses
    assert_equal 1, result.errors
    assert_equal 1, result.warnings

    error_offense = result.error_offenses.first

    assert_equal "Missing alt attribute", error_offense.message
    assert_equal "html-img-require-alt", error_offense.rule
  end

  def test_lint_result_to_s
    clean_result = Herb::LintResult.new([])
    assert_equal "✓ No lint offenses found", clean_result.to_s

    result = Herb::LintResult.new([@error_offense, @warning_offense])
    result_string = result.to_s

    assert_includes result_string, "✗ Found 2 lint offenses"
    assert_includes result_string, "1 errors"
    assert_includes result_string, "1 warnings"
  end

  def test_position_from_hash
    data = { line: 5, column: 10 }
    position = Herb::Position.from_hash(data)

    assert_equal 5, position.line
    assert_equal 10, position.column
  end

  def test_location_from_hash
    data = {
      start: { line: 1, column: 5 },
      end: { line: 2, column: 15 },
    }
    location = Herb::Location.from_hash(data)

    assert_equal 1, location.start.line
    assert_equal 5, location.start.column

    assert_equal 2, location.end.line
    assert_equal 15, location.end.column
  end
end
