# frozen_string_literal: true
# typed: true

require_relative "../report"

module Herb
  class Engine
    class Report
      # Where everything found while a page renders collects, so that findings from separate
      # producers end up in one payload rather than one channel each.
      #
      # Anything can record into the session that is open, without knowing whether one is open or who
      # else is recording:
      #
      #     Herb::Engine::Report::Session.record(diagnostic)
      #
      # A scoped session is one somebody opened deliberately, which is what a request or a test does.
      # Outside of one, recording still works and collects into a session nobody reads, so a producer
      # never has to guard its own calls.
      class Session
        STATE_KEY = :herb_engine_report_session #: Symbol

        attr_reader :report #: Herb::Engine::Report
        attr_reader :previous #: Session?

        #: () -> Session
        def self.current
          Thread.current[STATE_KEY] ||= new
        end

        #: [T] () { () -> T } -> Session
        def self.capture
          session = open

          yield

          session
        ensure
          close
        end

        #: () -> Session
        def self.open
          session = new(scoped: true, previous: Thread.current[STATE_KEY])

          Thread.current[STATE_KEY] = session

          session
        end

        #: () -> Session?
        def self.close
          session = Thread.current[STATE_KEY]

          Thread.current[STATE_KEY] = session.is_a?(Session) ? session.previous : nil

          session
        end

        #: (Herb::Diagnostic) -> Herb::Diagnostic
        def self.record(diagnostic)
          current.record(diagnostic)
        end

        def self.record_compile_diagnostics(template, entries)
          entries.each { |entry| record(compile_diagnostic(template, entry)) }

          nil
        end

        #: (String, Hash[Symbol, untyped]) -> Herb::Diagnostic
        def self.compile_diagnostic(template, entry)
          Herb::Diagnostic.new(
            template: template,
            message: entry[:message],
            severity: entry[:severity],
            code: entry[:code],
            origin: entry[:origin],
            suggestion: entry[:suggestion],
            location: compile_location(entry),
            phase: :compile
          )
        end

        #: (Hash[Symbol, untyped]) -> Herb::Location?
        def self.compile_location(entry)
          return nil unless entry[:line]

          Herb::Location.from(entry[:line], entry[:column], entry[:end_line], entry[:end_column])
        end

        #: (String, String?) -> void
        def self.source(template, source)
          current.source(template, source)
        end

        #: () -> bool
        def self.scoped?
          current.scoped?
        end

        #: () -> void
        def self.reset!
          Thread.current[STATE_KEY] = nil
        end

        #: (?scoped: bool, ?report: Herb::Engine::Report?, ?previous: Session?) -> void
        def initialize(scoped: false, report: nil, previous: nil)
          @scoped = scoped
          @report = report || Report.new
          @previous = previous
        end

        #: () -> bool
        def scoped?
          @scoped
        end

        #: (Herb::Diagnostic) -> Herb::Diagnostic
        def record(diagnostic)
          report.add(diagnostic)
        end

        #: (String, String?) -> void
        def source(template, source)
          report.source(template, source)
        end

        #: () -> Array[Herb::Diagnostic]
        def diagnostics
          report.diagnostics
        end

        #: () -> bool
        def empty?
          report.empty?
        end
      end
    end
  end
end
