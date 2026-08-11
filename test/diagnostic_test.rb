# frozen_string_literal: true

require_relative "test_helper"

class DiagnosticTest < Minitest::Spec
  test "serializes columns counting from one" do
    diagnostic = Herb::Diagnostic.new(
      template: "app/views/posts/show.html.erb",
      message: "Something is wrong.",
      location: Herb::Location.from(1, 0, 1, 37)
    )

    assert_equal({ line: 1, column: 1 }, diagnostic.to_h[:location][:start])
    assert_equal({ line: 1, column: 38 }, diagnostic.to_h[:location][:end])
  end

  test "leaves the location it was given counting columns from zero" do
    diagnostic = Herb::Diagnostic.new(template: "a.html.erb", message: "m", location: Herb::Location.from(1, 0, 1, 37))

    assert_equal 0, diagnostic.location.start.column
  end

  test "clamps a line below one rather than rejecting it" do
    diagnostic = Herb::Diagnostic.new(
      template: "a.html.erb",
      message: "m",
      location: Herb::Location.from(0, 0, 0, 0)
    )

    assert_equal 1, diagnostic.to_h[:location][:start][:line]
  end

  test "omits what it does not carry" do
    hash = Herb::Diagnostic.new(template: "a.html.erb", message: "m").to_h

    refute hash.key?(:location)
    refute hash.key?(:suggestion)
    refute hash.key?(:docs_url)
    refute hash.key?(:node)
  end

  test "names the keys the payload uses" do
    diagnostic = Herb::Diagnostic.new(
      template: "a.html.erb",
      message: "m",
      docs_url: "https://herb-tools.dev/diagnostics/x"
    )

    hash = diagnostic.to_h

    assert_equal "https://herb-tools.dev/diagnostics/x", hash[:docs_url]
    assert_equal :diagnostic, hash[:kind]
  end

  test "a metric carries a badge rather than a fault" do
    metric = Herb::Diagnostic.new(
      template: "a.html.erb",
      message: "This tag ran 3 queries",
      kind: :metric,
      value: "3 SQL queries"
    )

    assert_equal :metric, metric.to_h[:kind]
    assert_equal "3 SQL queries", metric.to_h[:value]
  end

  describe ".code_for" do
    test "hyphenates and drops the trailing Error" do
      assert_equal "missing-closing-tag", Herb::Diagnostic.code_for("MissingClosingTagError")
      assert_equal "render-layout-without-block", Herb::Diagnostic.code_for("RenderLayoutWithoutBlockError")
    end

    test "keeps a name that does not end in Error" do
      assert_equal "security-violation", Herb::Diagnostic.code_for("SecurityViolation")
    end

    test "splits an acronym on the last capital" do
      assert_equal "html-parse", Herb::Diagnostic.code_for("HTMLParseError")
      assert_equal "malformed-erb-closing-tag", Herb::Diagnostic.code_for("MalformedERBClosingTagError")
    end
  end

  describe ".from" do
    test "builds one from a parser error without shifting the column" do
      error = Herb.parse("<div><p></div>").errors.first
      diagnostic = Herb::Diagnostic.from(error, template: "a.html.erb", origin: "Herb Parser")

      assert_equal "missing-closing-tag", diagnostic.code
      assert_equal error.location.start.column, diagnostic.location.start.column
      assert_equal error.location.start.column + 1, diagnostic.to_h[:location][:start][:column]
      assert_equal :compile, diagnostic.phase
    end

    test "returns a diagnostic it is handed" do
      diagnostic = Herb::Diagnostic.new(template: "a.html.erb", message: "m")

      assert_same diagnostic, Herb::Diagnostic.from(diagnostic, template: "b.html.erb", origin: "Herb Parser")
    end

    test "builds one from the hash shape the validators used to produce" do
      diagnostic = Herb::Diagnostic.from(
        { message: "m", severity: :warning, code: "x", location: Herb::Location.from(1, 0, 1, 37), suggestion: "s" },
        template: "a.html.erb",
        origin: "Herb Parser"
      )

      assert_equal :warning, diagnostic.severity
      assert_equal "s", diagnostic.suggestion
    end
  end

  describe "#key" do
    test "matches on template, line and code, ignoring the column" do
      first = Herb::Diagnostic.new(template: "a.html.erb", message: "m", code: "c", location: Herb::Location.from(3, 2, 3, 9))
      second = Herb::Diagnostic.new(template: "a.html.erb", message: "different", code: "c", location: Herb::Location.from(3, 40, 3, 44))

      assert_equal first.key, second.key
    end

    test "falls back to the message when there is no code" do
      diagnostic = Herb::Diagnostic.new(template: "a.html.erb", message: "m")

      assert_equal ["a.html.erb", nil, "m"], diagnostic.key
    end
  end

  test "reads as a location and a message" do
    diagnostic = Herb::Diagnostic.new(
      template: "app/views/a.html.erb",
      message: "Something is wrong.",
      code: "something-wrong",
      location: Herb::Location.from(1, 0, 1, 37)
    )

    assert_equal "app/views/a.html.erb:1:1: [something-wrong] Something is wrong.", diagnostic.to_s
  end
end
