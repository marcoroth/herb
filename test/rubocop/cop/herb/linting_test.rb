# frozen_string_literal: true

require_relative "../../../test_helper"
require "rubocop-herb"

class RuboCop::Cop::Herb::LintingTest < Minitest::Spec
  def create_cop(config_hash = {})
    config = RuboCop::Config.new("Herb/Linting" => { "Enabled" => true }.merge(config_hash))

    RuboCop::Cop::Herb::Linting.new(config)
  end

  def investigate(cop, source, file_path)
    processed_source = RuboCop::ProcessedSource.new(source, RUBY_VERSION.to_f, file_path)
    commissioner = RuboCop::Cop::Commissioner.new([cop])
    report = commissioner.investigate(processed_source)
    report.offenses
  end

  describe "template file detection" do
    test "lints .erb files" do
      skip "Herb linter not available" unless Herb::Linter.available?

      cop = create_cop
      offenses = investigate(cop, "<div class=foo></div>", "app/views/test.erb")

      refute_empty offenses
    end

    test "lints .html files" do
      skip "Herb linter not available" unless Herb::Linter.available?

      cop = create_cop
      offenses = investigate(cop, "<div class=foo></div>", "app/views/test.html")

      refute_empty offenses
    end

    test "lints .html.erb files" do
      skip "Herb linter not available" unless Herb::Linter.available?

      cop = create_cop
      offenses = investigate(cop, "<div class=foo></div>", "app/views/test.html.erb")

      refute_empty offenses
    end

    test "lints .htm files" do
      skip "Herb linter not available" unless Herb::Linter.available?

      cop = create_cop
      offenses = investigate(cop, "<div class=foo></div>", "app/views/test.htm")

      refute_empty offenses
    end

    test "does not lint .rb files" do
      cop = create_cop
      offenses = investigate(cop, "puts 'hello'", "app/models/user.rb")

      assert_empty offenses
    end

    test "does not lint .js files" do
      cop = create_cop
      offenses = investigate(cop, "console.log('hi')", "app/javascript/app.js")

      assert_empty offenses
    end
  end

  describe "offense reporting" do
    test "reports offenses with correct messages" do
      skip "Herb linter not available" unless Herb::Linter.available?

      cop = create_cop
      offenses = investigate(cop, "<div class=foo></div>", "test.erb")

      refute_empty offenses

      offense = offenses.find { |o| o.message.include?("html-attribute-values-require-quotes") }
      assert offense, "Expected an html-attribute-values-require-quotes offense"
      assert_match(/\[html-attribute-values-require-quotes\]/, offense.message)
    end

    test "maps error severity correctly" do
      skip "Herb linter not available" unless Herb::Linter.available?

      cop = create_cop
      offenses = investigate(cop, "<div class=foo></div>", "test.erb")

      error_offense = offenses.find { |o| o.message.include?("html-attribute-values-require-quotes") }
      assert error_offense, "Expected an html-attribute-values-require-quotes offense"
      assert_equal :error, error_offense.severity.name
    end

    test "maps warning severity correctly" do
      skip "Herb linter not available" unless Herb::Linter.available?

      cop = create_cop
      source = "<div class=foo>\n<br/>\n</div>"
      offenses = investigate(cop, source, "test.erb")

      refute_empty offenses

      offenses.each do |o|
        assert_includes %i[error warning convention refactor], o.severity.name
      end
    end

    test "reports correct line and column positions" do
      skip "Herb linter not available" unless Herb::Linter.available?

      cop = create_cop
      source = "<div>\n  <span class=foo></span>\n</div>"
      offenses = investigate(cop, source, "test.erb")

      attribute_offense = offenses.find { |offense| offense.message.include?("html-attribute-values-require-quotes") }
      assert attribute_offense, "Expected an html-attribute-values-require-quotes offense on line 2"
      assert_equal 2, attribute_offense.line
    end
  end

  describe "edge cases" do
    test "produces no offenses for empty files" do
      skip "Herb linter not available" unless Herb::Linter.available?

      cop = create_cop
      offenses = investigate(cop, "", "test.erb")

      assert_empty offenses
    end

    test "produces no offenses for clean templates" do
      skip "Herb linter not available" unless Herb::Linter.available?

      cop = create_cop
      offenses = investigate(cop, "<div>\n  <p>Hello</p>\n</div>\n", "test.erb")

      assert_empty offenses
    end

    test "handles files gracefully when linter is unavailable" do
      cop = create_cop

      original = Herb::Linter.method(:available?)
      Herb::Linter.define_singleton_method(:available?) { false }

      begin
        offenses = investigate(cop, "<div class=foo></div>", "test.erb")
        assert_empty offenses
      ensure
        Herb::Linter.define_singleton_method(:available?, original)
      end
    end
  end

  describe "multiple offenses" do
    test "reports multiple offenses from different locations" do
      skip "Herb linter not available" unless Herb::Linter.available?

      cop = create_cop
      source = "<div class=foo>\n<a>\n</a>\n</div>"
      offenses = investigate(cop, source, "test.erb")

      assert offenses.length >= 2, "Expected at least 2 offenses, got #{offenses.length}"
    end
  end

  describe "severity mapping" do
    test "SEVERITY_MAP covers all expected herb severities" do
      map = RuboCop::Cop::Herb::Linting::SEVERITY_MAP

      assert_equal :error, map["error"]
      assert_equal :warning, map["warning"]
      assert_equal :convention, map["info"]
      assert_equal :refactor, map["hint"]
    end

    test "unknown severity defaults to convention" do
      cop = create_cop
      result = cop.send(:map_severity, "unknown")

      assert_equal :convention, result
    end
  end

  describe "offense message format" do
    test "message includes rule name in brackets" do
      skip "Herb linter not available" unless Herb::Linter.available?

      cop = create_cop
      offenses = investigate(cop, "<div class=foo></div>", "test.erb")

      refute_empty offenses

      offenses.each do |o|
        assert_match(/\[[\w-]+\] .+/, o.message, "Offense message should be formatted as [rule-name] description")
      end
    end
  end
end
