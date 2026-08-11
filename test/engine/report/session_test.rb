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
  end
end
