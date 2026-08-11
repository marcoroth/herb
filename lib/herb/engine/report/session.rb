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

        #: [T] (String?, Integer, Integer, ?Symbol?) { () -> T } -> T
        def self.at(template, line, column, via = nil)
          enter(template, line, column, via)

          yield
        ensure
          leave
        end

        #: (String?, Integer, Integer, ?Symbol?) -> void
        def self.enter(template, line, column, via = nil)
          current.enter(template, line, column, via)
        end

        #: () -> void
        def self.leave
          current.leave
        end

        #: [T] (String?) { () -> T } -> T
        def self.render(template)
          enter_render(template)

          yield
        ensure
          leave_render
        end

        #: (String?) -> String
        def self.enter_render(template)
          current.enter_render(template)
        end

        #: () -> void
        def self.leave_render
          current.leave_render
        end

        #: () -> String?
        def self.current_node
          current.current_node
        end

        #: (Symbol, untyped, origin: String) -> void
        def self.annotate(key, value, origin:)
          current.annotate(key, value, origin: origin)
        end

        #: (Symbol, untyped) -> void
        def self.observe(key, value)
          current.observe(key, value)
        end

        #: () -> Array[Array[untyped]]
        def self.stack
          current.stack
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
          @renders = [] #: Array[String]
          @minted = 0 #: Integer
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

        #: (String?, Integer, Integer, ?Symbol?) -> void
        def enter(template, line, column, via = nil)
          @frames.push([template, line, column, via])

          nil
        end

        #: () -> void
        def leave
          @frames.pop

          nil
        end

        # Every tag still rendering, innermost first, the way `caller` reads.
        #
        # A tag that renders a partial is still open while the partial renders, so once more than one
        # template is instrumented this is a render stack across all of them and not just within one.
        # Only the innermost frame is what an observation is filed under, so anything wanting the rest
        # has to take it while it still exists:
        #
        #     ActiveSupport::Notifications.subscribe("sql.active_record") do |*, payload|
        #       Herb::Engine::Report::Session.observe(:queries, { sql: payload[:sql], stack: Herb::Engine::Report::Session.stack })
        #     end
        #
        # Taking it costs an array per observation, which is why it is offered rather than recorded.
        #: () -> Array[Array[untyped]]
        def stack
          @frames.reverse.map { |frame| frame.first(3) }
        end

        # Filed under the render it happened in, not only the position it happened at.
        #
        # A partial rendered three times has one tag at one position, so keying on position alone
        # merges all three into one entry reading "3 queries" at one place. That reads as one slow
        # tag when the finding is a tag that runs once per item, which is the thing worth noticing.
        #: (Symbol, untyped) -> void
        def observe(key, value)
          frame = @frames.last

          return unless frame

          entry = (@entries[[@renders.last, frame[0], frame[1], frame[2]]] ||= Entry.new(frame[0], frame[1], frame[2]))

          entry.observe(key, value)

          nil
        end

        # One render of one template, which is what a node in the payload is.
        #
        # A template rendered three times is three nodes, because what gets said about it is said
        # about an occurrence and not about the file. The id is minted here so there is exactly one
        # of them per occurrence, rather than one per producer that wants to name it.
        #
        # The tag that is open when a render starts is the tag that started it, so the call site
        # comes for free. Without it the tree would say a partial rendered twice under one parent but
        # not from where, which `stack` can say and a payload built from the tree alone could not.
        #: (String?) -> String
        def enter_render(template)
          id = (@minted += 1).to_s

          report.render(id, template, @renders.last, called_from: @frames.last)
          @renders.push(id)

          id
        end

        #: () -> void
        def leave_render
          @renders.pop

          nil
        end

        #: () -> String?
        def current_node
          @renders.last
        end

        #: (Symbol, untyped, origin: String) -> void
        def annotate(key, value, origin:)
          node = current_node

          return unless node

          report.annotate(node, key, value, origin: origin)

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
