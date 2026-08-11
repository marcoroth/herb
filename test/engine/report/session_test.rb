# frozen_string_literal: true

require_relative "../../test_helper"

module Engine
  class ReportSessionTest < Minitest::Spec
    before do
      Herb::Engine::Report::Session.reset!
    end

    after do
      Herb::Engine::Report::Session.reset!
    end

    def diagnostic(message: "m", code: "c")
      Herb::Diagnostic.new(
        template: "app/views/a.html.erb",
        message: message,
        code: code,
        origin: "Herb Compiler",
        location: Herb::Location.from(1, 0, 1, 4)
      )
    end

    test "records outside a scope, so a producer never has to guard its calls" do
      Herb::Engine::Report::Session.record(diagnostic)

      assert_equal 1, Herb::Engine::Report::Session.current.diagnostics.length
      refute_predicate Herb::Engine::Report::Session, :scoped?
    end

    test "collects what was recorded during a capture" do
      session = Herb::Engine::Report::Session.capture do
        Herb::Engine::Report::Session.record(diagnostic(message: "inside"))
      end

      assert_equal ["inside"], session.diagnostics.map(&:message)
      assert_predicate session, :scoped?
    end

    test "closes the scope when the capture ends" do
      Herb::Engine::Report::Session.capture { nil }

      refute_predicate Herb::Engine::Report::Session, :scoped?
    end

    test "gives the outer session back after a nested one, rather than discarding it" do
      outer = Herb::Engine::Report::Session.capture do
        Herb::Engine::Report::Session.record(diagnostic(code: "outer"))

        Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.record(diagnostic(code: "inner"))
        end

        Herb::Engine::Report::Session.record(diagnostic(code: "outer-again"))
      end

      assert_equal ["outer", "outer-again"], outer.diagnostics.map(&:code)
    end

    test "keeps a nested session's findings out of the outer one" do
      inner = nil

      Herb::Engine::Report::Session.capture do
        inner = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.record(diagnostic(code: "inner"))
        end
      end

      assert_equal ["inner"], inner.diagnostics.map(&:code)
    end

    test "restores the scope even when the block raises" do
      assert_raises(RuntimeError) do
        Herb::Engine::Report::Session.capture { raise "boom" }
      end

      refute_predicate Herb::Engine::Report::Session, :scoped?
    end

    test "carries sources through to the payload" do
      session = Herb::Engine::Report::Session.capture do
        Herb::Engine::Report::Session.record(diagnostic)
        Herb::Engine::Report::Session.source("app/views/a.html.erb", "<div></div>\n")
      end

      assert_equal({ "app/views/a.html.erb" => "<div></div>\n" }, session.report.to_h[:sources])
    end

    test "is empty until something is recorded" do
      session = Herb::Engine::Report::Session.capture { nil }

      assert_predicate session, :empty?
    end

    describe "open and close, for somewhere a block will not reach" do
      test "collects between the two calls" do
        session = Herb::Engine::Report::Session.open
        Herb::Engine::Report::Session.record(diagnostic)
        Herb::Engine::Report::Session.close

        assert_equal 1, session.diagnostics.length
        refute_predicate Herb::Engine::Report::Session, :scoped?
      end

      test "nests the same way capture does" do
        outer = Herb::Engine::Report::Session.open
        inner = Herb::Engine::Report::Session.open

        Herb::Engine::Report::Session.record(diagnostic(code: "inner"))
        Herb::Engine::Report::Session.close

        Herb::Engine::Report::Session.record(diagnostic(code: "outer"))
        Herb::Engine::Report::Session.close

        assert_equal ["inner"], inner.diagnostics.map(&:code)
        assert_equal ["outer"], outer.diagnostics.map(&:code)
      end

      test "closing when nothing is open leaves nothing open" do
        assert_nil Herb::Engine::Report::Session.close
        refute_predicate Herb::Engine::Report::Session, :scoped?
      end
    end

    test "does not leak between threads" do
      Herb::Engine::Report::Session.record(diagnostic)

      other = Thread.new { Herb::Engine::Report::Session.current.diagnostics.length }.value

      assert_equal 0, other
      assert_equal 1, Herb::Engine::Report::Session.current.diagnostics.length
    end

    describe "attributing what happens to the tag that caused it" do
      def session_with_frames
        Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.at("a.html.erb", 3, 7) do
            Herb::Engine::Report::Session.observe(:queries, "SELECT 1")
            Herb::Engine::Report::Session.observe(:queries, "SELECT 2")
          end

          Herb::Engine::Report::Session.at("a.html.erb", 1, 0) do
            Herb::Engine::Report::Session.observe(:queries, "SELECT 3")
          end
        end
      end

      test "keeps each position apart" do
        entries = session_with_frames.entries

        assert_equal([[1, 0], [3, 7]], entries.map { |entry| [entry.line, entry.column] })
        assert_equal 1, entries.first[:queries].length
        assert_equal 2, entries.last[:queries].length
      end

      test "orders them the way they appear in the template" do
        assert_equal [1, 3], session_with_frames.entries.map(&:line)
      end

      test "drops what happens outside any tag" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.observe(:queries, "SELECT 1")
        end

        assert_empty session.entries
      end

      test "attributes to the innermost tag" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.at("a.html.erb", 1, 0) do
            Herb::Engine::Report::Session.at("a.html.erb", 2, 4) do
              Herb::Engine::Report::Session.observe(:queries, "SELECT 1")
            end
          end
        end

        assert_equal([[2, 4]], session.entries.map { |entry| [entry.line, entry.column] })
      end

      test "leaves the frame even when the tag raises" do
        session = Herb::Engine::Report::Session.capture do
          begin
            Herb::Engine::Report::Session.at("a.html.erb", 1, 0) { raise "boom" }
          rescue RuntimeError
            nil
          end

          Herb::Engine::Report::Session.observe(:queries, "after the failure")
        end

        assert_empty session.entries
      end

      test "turns what one tag observed into a metric carrying a badge and no severity" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.at("a.html.erb", 7, 8) do
            Herb::Engine::Report::Session.observe(:queries, "SELECT 1")
            Herb::Engine::Report::Session.observe(:queries, "SELECT 2")
          end
        end

        diagnostic = session.measure(:queries, origin: "Herb Engine", code: "sql-queries") { |queries|
          "#{queries.size} SQL queries"
        }.first

        assert_equal "2 SQL queries", diagnostic.value
        assert_equal :metric, diagnostic.kind
        assert_nil diagnostic.severity
        assert_equal "a.html.erb", diagnostic.template
        assert_equal 7, diagnostic.location.start.line
        assert_equal ["SELECT 1", "SELECT 2"], diagnostic.data[:queries]
      end

      test "measures only the tags that observed something" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.at("a.html.erb", 1, 0) do
            Herb::Engine::Report::Session.observe(:renders, "partial")
          end

          Herb::Engine::Report::Session.at("a.html.erb", 2, 0) do
            Herb::Engine::Report::Session.observe(:queries, "SELECT 1")
          end
        end

        measured = session.measure(:queries, origin: "Herb Engine") { |queries| queries.size.to_s }

        assert_equal [2], measured.map { |diagnostic| diagnostic.location.start.line }.sort
      end

      test "puts what it measured into the payload" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.at("a.html.erb", 1, 0) do
            Herb::Engine::Report::Session.observe(:queries, "SELECT 1")
          end
        end

        session.measure(:queries, origin: "Herb Engine", code: "sql-queries") { |queries|
          "#{queries.size} SQL query"
        }

        assert_includes session.report.to_json, %("value":"1 SQL query")
      end

      test "reports every tag still rendering, innermost first" do
        stack = nil

        Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.at("layouts/application.html.erb", 2, 2) do
            Herb::Engine::Report::Session.at("posts/index.html.erb", 4, 4) do
              Herb::Engine::Report::Session.at("posts/_card.html.erb", 1, 2) do
                stack = Herb::Engine::Report::Session.stack
              end
            end
          end
        end

        assert_equal [
          ["posts/_card.html.erb", 1, 2],
          ["posts/index.html.erb", 4, 4],
          ["layouts/application.html.erb", 2, 2]
        ], stack
      end

      test "reports an empty stack outside of any tag" do
        assert_empty Herb::Engine::Report::Session.capture { nil }.stack
      end

      test "hands out a stack that cannot be used to corrupt the live one" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.at("a.html.erb", 1, 0) do
            Herb::Engine::Report::Session.stack.each(&:clear)

            Herb::Engine::Report::Session.observe(:queries, "SELECT 1")
          end
        end

        entry = session.entries.first

        assert_equal ["a.html.erb", 1, 0], [entry.template, entry.line, entry.column]
      end

      test "collects the same position across renders into one entry" do
        session = Herb::Engine::Report::Session.capture do
          2.times do
            Herb::Engine::Report::Session.at("a.html.erb", 1, 0) do
              Herb::Engine::Report::Session.observe(:queries, "SELECT 1")
            end
          end
        end

        assert_equal 1, session.entries.length
        assert_equal 2, session.entries.first[:queries].length
      end
    end
  end
end
