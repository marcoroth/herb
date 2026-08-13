# frozen_string_literal: true

require "test_helper"

class DiagnosticTest < Minitest::Test
  def test_marks_a_diagnostic_inline
    output = plain(Herb::Highlighter.new.highlight(TestHelper::TEMPLATE, path: "show.html.erb", diagnostics: [diagnostic]))

    assert_includes output, "Image is missing an alt attribute"
    assert_includes output, "html-img-require-alt"
    assert_includes output, "~"
  end

  def test_renders_a_single_diagnostic_snippet
    output = plain(Herb::Highlighter.new.highlight_diagnostic(TestHelper::TEMPLATE, diagnostic, path: "show.html.erb", context_lines: 1))

    assert_includes output, "show.html.erb:2:2"
    assert_includes output, "Image is missing an alt attribute"
  end

  def test_accepts_string_keys
    stringified = JSON.parse(JSON.generate(diagnostic))

    assert_includes plain(Herb::Highlighter.new.highlight(TestHelper::TEMPLATE, diagnostics: [stringified])), "alt attribute"
  end

  def test_ignores_keys_the_renderer_does_not_know
    noisy = diagnostic(template: "show.html.erb", origin: "linter", suggestion: "add alt", docs_url: "https://example.com")

    assert_includes plain(Herb::Highlighter.new.highlight(TestHelper::TEMPLATE, diagnostics: [noisy])), "alt attribute"
  end

  def test_every_severity_renders
    [:error, :warning, :info, :hint].each do |severity|
      output = plain(Herb::Highlighter.new.highlight(TestHelper::TEMPLATE, diagnostics: [diagnostic(severity: severity)]))

      assert_includes output, severity.to_s
    end
  end

  def test_accepts_tags
    tagged = diagnostic(tags: [:deprecated])

    assert_includes plain(Herb::Highlighter.new.highlight(TestHelper::TEMPLATE, diagnostics: [tagged])), "alt attribute"
  end

  def test_splits_diagnostics_into_separate_snippets
    diagnostics = [diagnostic, diagnostic(message: "second", code: "other")]
    output = plain(Herb::Highlighter.new.highlight(TestHelper::TEMPLATE, diagnostics: diagnostics, split_diagnostics: true))

    assert_includes output, "[1/2]"
    assert_includes output, "second"
  end

  def test_names_the_allowed_severities_when_one_is_wrong
    error = assert_raises(Herb::Highlighter::Error) do
      Herb::Highlighter.new.highlight(TestHelper::TEMPLATE, diagnostics: [diagnostic(severity: :fatal)])
    end

    assert_includes error.message, "unknown variant `fatal`"
    assert_includes error.message, "`error`, `warning`, `info`, `hint`"
  end

  def test_names_the_allowed_tags_when_one_is_wrong
    error = assert_raises(Herb::Highlighter::Error) do
      Herb::Highlighter.new.highlight(TestHelper::TEMPLATE, diagnostics: [diagnostic(tags: [:whatever])])
    end

    assert_includes error.message, "unknown variant `whatever`"
  end

  def test_reports_a_missing_message
    error = assert_raises(Herb::Highlighter::Error) do
      Herb::Highlighter.new.highlight(TestHelper::TEMPLATE, diagnostics: [diagnostic.except(:message)])
    end

    assert_includes error.message, "missing field `message`"
  end

  def test_reports_a_missing_location
    error = assert_raises(Herb::Highlighter::Error) do
      Herb::Highlighter.new.highlight(TestHelper::TEMPLATE, diagnostics: [diagnostic.except(:location)])
    end

    assert_includes error.message, "missing field `location`"
  end
end
