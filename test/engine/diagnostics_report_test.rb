# frozen_string_literal: true

require_relative "../test_helper"

module Engine
  class DiagnosticsReportTest < Minitest::Spec
    def report
      @report ||= Herb::Engine::DiagnosticsReport.new
    end

    def diagnostic(template: "app/views/a.html.erb", message: "m", code: "c", line: 1)
      Herb::Diagnostic.new(
        template: template,
        message: message,
        code: code,
        origin: "Herb Compiler",
        location: Herb::Location.from(line, 0, line, 4)
      )
    end

    test "is empty until something is reported" do
      assert_predicate report, :empty?
      assert_equal({ version: 1, diagnostics: [], sources: {} }, report.to_h)
    end

    test "carries the version the reader checks" do
      assert_equal 1, Herb::Engine::DiagnosticsReport::VERSION
      assert_equal 1, report.to_h[:version]
    end

    test "collects what it is given" do
      report.add(diagnostic(message: "first"))
      report.add(diagnostic(message: "second", code: "d"))

      assert_equal ["first", "second"], report.diagnostics.map(&:message)
    end

    test "concat takes several at once" do
      both = [diagnostic(code: "a"), diagnostic(code: "b")]

      report.concat(both)

      assert_equal 2, report.diagnostics.length
    end

    test "collapses a repeat onto the entry it already holds" do
      report.add(diagnostic(message: "first"))
      report.add(diagnostic(message: "ignored, same key"))

      assert_equal 1, report.diagnostics.length
      assert_equal "first", report.diagnostics.first.message
    end

    test "keeps findings that differ by line" do
      report.add(diagnostic(line: 1))
      report.add(diagnostic(line: 2))

      assert_equal 2, report.diagnostics.length
    end

    test "drops the oldest past the cap rather than growing" do
      capped = Herb::Engine::DiagnosticsReport.new(max_diagnostics: 2)

      capped.add(diagnostic(code: "first"))
      capped.add(diagnostic(code: "second"))
      capped.add(diagnostic(code: "third"))

      assert_equal ["second", "third"], capped.diagnostics.map(&:code)
    end

    test "carries an empty sources map rather than dropping the key" do
      report.add(diagnostic)

      assert_equal({}, report.to_h[:sources])
    end

    test "carries a source when given one" do
      report.add(diagnostic)
      report.source("app/views/a.html.erb", "<div></div>\n")

      assert_equal({ "app/views/a.html.erb" => "<div></div>\n" }, report.to_h[:sources])
    end

    test "ignores a source it cannot resolve" do
      report.source("app/views/a.html.erb", nil)

      assert_empty report.sources
    end

    describe "the script tag" do
      test "is inert JSON the reader can find" do
        report.add(diagnostic)

        assert_includes report.to_html, '<script type="application/json" data-herb-diagnostics'
        assert_includes report.to_html, "</script>"
      end

      test "counts what it carries, so a test need not parse it" do
        report.add(diagnostic)

        assert_includes report.to_html, 'data-count="1"'
      end

      test "cannot close the script element early" do
        report.add(diagnostic(message: "</script><img src=x onerror=alert(1)>"))

        refute_includes report.to_html, "</script><img"
        assert_includes report.to_html, "\\u003c/script"
        assert_equal 1, report.to_html.scan("</script>").length
      end
    end

    describe "what crosses to the reader" do
      test "serializes severity and kind as the strings the reader matches on" do
        report.add(diagnostic)

        payload = JSON.parse(report.to_json)
        entry = payload["diagnostics"].first

        assert_equal "error", entry["severity"]
        assert_equal "diagnostic", entry["kind"]
      end

      test "counts columns from one, the way the payload does" do
        report.add(diagnostic)

        entry = JSON.parse(report.to_json)["diagnostics"].first

        assert_equal 1, entry["location"]["start"]["column"]
        assert_equal 1, entry["location"]["start"]["line"]
      end

      test "names every key the reader requires" do
        report.add(diagnostic)

        entry = JSON.parse(report.to_json)["diagnostics"].first

        assert_equal "app/views/a.html.erb", entry["template"]
        assert_equal "m", entry["message"]
      end

      # The payload is snake_case throughout, including the one key the published spec spells
      # `docsUrl`. `runtime-report.ts` has to read `docs_url` for this to survive normalization.
      test "spells the documentation link the way the rest of the payload is spelled" do
        report.add(
          Herb::Diagnostic.new(
            template: "app/views/a.html.erb",
            message: "m",
            docs_url: "https://herb-tools.dev/diagnostics/x"
          )
        )

        entry = JSON.parse(report.to_json)["diagnostics"].first

        assert_equal "https://herb-tools.dev/diagnostics/x", entry["docs_url"]
        refute entry.key?("docsUrl")
      end
    end
  end
end
