# frozen_string_literal: true
# typed: true

require_relative "../report"
require_relative "entry"

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
          entries.each { |entry| record(Herb::Diagnostic.from_compiled(template, entry)) }

          nil
        end

        #: [T] (String?, Integer, Integer) { () -> T } -> T
        def self.at(template, line, column)
          enter(template, line, column)

          yield
        ensure
          leave
        end

        #: (String?, Integer, Integer) -> void
        def self.enter(template, line, column)
          current.enter(template, line, column)
        end

        #: () -> void
        def self.leave
          current.leave
        end

        #: (Symbol, untyped) -> void
        def self.observe(key, value)
          current.observe(key, value)
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
          @frames = [] #: Array[Array[untyped]]
          @entries = {} #: Hash[Array[untyped], Herb::Engine::Report::Entry]
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
          report.empty? && entries.empty?
        end

        #: (String?, Integer, Integer) -> void
        def enter(template, line, column)
          @frames.push([template, line, column])

          nil
        end

        #: () -> void
        def leave
          @frames.pop

          nil
        end

        #: (Symbol, untyped) -> void
        def observe(key, value)
          frame = @frames.last

          return unless frame

          entry = (@entries[frame] ||= Entry.new(frame[0], frame[1], frame[2]))
          entry.observe(key, value)

          nil
        end

        #: () -> Array[Herb::Engine::Report::Entry]
        def entries
          @entries.values.sort_by { |entry| [entry.template.to_s, entry.line, entry.column] }
        end

        # Turns what was observed under one key into one diagnostic per tag that saw any.
        #
        #     ActiveSupport::Notifications.subscribe("sql.active_record") do |*, payload|
        #       Herb::Engine::Report::Session.observe(:queries, payload[:sql]) unless payload[:cached]
        #     end
        #
        #     session.measure(:queries, origin: "Herb Engine", code: "sql-queries") do |queries|
        #       "#{queries.size} SQL queries"
        #     end
        #
        # A count is a measurement rather than a fault, so what comes out carries a badge and no
        # severity. Three queries at one tag is worth showing every time and worth worrying about
        # only sometimes, and which of those it is depends on what the tag is for. Reporting it as a
        # warning would make that call on the reader's behalf and get it wrong often enough to train
        # them to ignore it.
        #: (Symbol, origin: String, ?code: String?, ?message: String?) { (Array[untyped]) -> String } -> Array[Herb::Diagnostic]
        def measure(key, origin:, code: nil, message: nil)
          entries.filter_map { |entry|
            observed = entry[key]

            next if observed.empty?

            value = yield(observed)

            record(
              Herb::Diagnostic.new(
                template: entry.template.to_s,
                message: message || value,
                severity: nil,
                kind: :metric,
                origin: origin,
                code: code,
                location: entry.location,
                value: value,
                data: { key => observed }
              )
            )
          }
        end
      end
    end
  end
end
