# frozen_string_literal: true
# typed: true

require_relative "report"
require_relative "entry"

module Herb
  class Engine
    module Runtime
      # Where everything found while a page renders collects, so that findings from separate
      # producers end up in one payload rather than one channel each.
      #
      # Anything can record into the session that is open, without knowing whether one is open or who
      # else is recording:
      #
      #     Herb::Engine::Runtime::Session.record(diagnostic)
      #
      # A scoped session is one somebody opened deliberately, which is what a request or a test does.
      # Outside of one, recording still works and collects into a session nobody reads, so a producer
      # never has to guard its own calls.
      #
      class Session
        Measurement = Data.define(:key, :origin, :code, :message, :description, :kind, :per, :block)

        STATE_KEY = :herb_engine_report_session #: Symbol
        RACTOR_KEY = :herb_engine_report_session_ractor #: Symbol
        THREAD_KEY = :herb_engine_report_session_thread #: Symbol

        attr_reader :report #: Herb::Engine::Runtime::Report
        attr_reader :previous #: Session?

        #: () -> Session?
        def self.stored
          return nil unless Fiber[RACTOR_KEY].equal?(Ractor.current)
          return nil unless Fiber[THREAD_KEY] == Thread.current.object_id

          Fiber[STATE_KEY]
        end

        #: (Session?) -> void
        def self.store(session)
          Fiber[STATE_KEY] = session
          Fiber[RACTOR_KEY] = session && Ractor.current
          Fiber[THREAD_KEY] = session && Thread.current.object_id

          nil
        end

        #: () -> Session
        def self.current
          session = stored || new

          store(session)

          session
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
          session = new(scoped: true, previous: stored)

          store(session)

          session
        end

        #: () -> Session?
        def self.close
          session = stored

          store(session&.previous)

          session
        end

        #: (Herb::Diagnostic) -> Herb::Diagnostic
        def self.record(diagnostic)
          current.record(diagnostic)
        end

        def self.record_compile_diagnostics(template, entries)
          entries.each { |entry| record(Herb::Diagnostic.from_compiled(template, entry)) }

          read_source(template)

          nil
        end

        #: (String) -> void
        def self.read_source(template)
          return unless scoped?

          session = current

          return if session.report.sources.key?(template)

          session.source(template, File.read(template))
        rescue SystemCallError, IOError
          nil
        end

        #: [T] (String?, Integer, Integer, ?Symbol?, ?end_line: Integer?, ?end_column: Integer?) { () -> T } -> T
        def self.at(template, line, column, via = nil, end_line: nil, end_column: nil)
          enter(template, line, column, via, end_line: end_line, end_column: end_column)

          yield
        ensure
          leave
        end

        #: (String?, Integer, Integer, ?Symbol?, ?end_line: Integer?, ?end_column: Integer?) -> void
        def self.enter(template, line, column, via = nil, end_line: nil, end_column: nil)
          current.enter(template, line, column, via, end_line: end_line, end_column: end_column)
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

        #: (Symbol, origin: String, ?code: String?, ?message: String?, ?description: (^(Array[untyped]) -> String)?, ?kind: Symbol, ?per: Symbol) { (Array[untyped]) -> String } -> void
        def self.measurement(key, origin:, code: nil, message: nil, description: nil, kind: :metric, per: :render, &block)
          measurements << Measurement.new(key: key, origin: origin, code: code, message: message, description: description, kind: kind, per: per, block: block)

          nil
        end

        #: () -> Array[Herb::Engine::Runtime::Session::Measurement]
        def self.measurements
          @measurements ||= [] #: Array[Measurement]
        end

        #: () -> void
        def self.clear_measurements
          measurements.clear

          nil
        end

        #: () -> void
        def self.reset!
          store(nil)

          nil
        end

        #: (?scoped: bool, ?report: Herb::Engine::Runtime::Report?, ?previous: Session?) -> void
        def initialize(scoped: false, report: nil, previous: nil)
          @scoped = scoped
          @report = report || Report.new
          @frames = [] #: Array[Array[untyped]]
          @entries = {} #: Hash[Array[untyped], Herb::Engine::Runtime::Entry]
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
          report.add(diagnostic.with_node(current_node))
        end

        #: (String, String?) -> void
        def source(template, source)
          report.source(template, source)
        end

        #: (Symbol) { () -> untyped } -> untyped
        def channel(name, &)
          report.channel(name, &)
        end

        #: () -> Array[Herb::Diagnostic]
        def diagnostics
          report.diagnostics
        end

        #: () -> bool
        def empty?
          report.empty? && entries.empty?
        end

        #: (String?, Integer, Integer, ?Symbol?, ?end_line: Integer?, ?end_column: Integer?) -> void
        def enter(template, line, column, via = nil, end_line: nil, end_column: nil)
          @frames.push([template, line, column, via, end_line, end_column])

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
        #       Herb::Engine::Runtime::Session.observe(:queries, { sql: payload[:sql], stack: Herb::Engine::Runtime::Session.stack })
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

          entry = (@entries[[@renders.last, frame[0], frame[1], frame[2]]] ||= Entry.new(frame[0], frame[1], frame[2], frame[4], frame[5]))

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

        #: () -> Array[Herb::Engine::Runtime::Entry]
        def entries
          @entries.values.sort_by { |entry| [entry.template.to_s, entry.line, entry.column] }
        end

        #: () -> Array[Herb::Diagnostic]
        def apply_measurements
          self.class.measurements.flat_map do |measurement|
            measure(
              measurement.key,
              origin: measurement.origin,
              code: measurement.code,
              message: measurement.message,
              description: measurement.description,
              kind: measurement.kind,
              per: measurement.per,
              &measurement.block
            )
          end
        end

        # Turns what was observed under one key into one diagnostic per tag that saw any.
        #
        #     ActiveSupport::Notifications.subscribe("sql.active_record") do |*, payload|
        #       Herb::Engine::Runtime::Session.observe(:queries, payload[:sql]) unless payload[:cached]
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
        #
        #: (Symbol, origin: String, ?code: String?, ?message: String?, ?description: (^(Array[untyped]) -> String)?, ?kind: Symbol, ?per: Symbol) { (Array[untyped]) -> String } -> Array[Herb::Diagnostic]
        def measure(key, origin:, code: nil, message: nil, description: nil, kind: :metric, per: :render)
          measurable(key, per).filter_map { |entry, observed|
            value = yield(observed)

            record(
              Herb::Diagnostic.new(
                template: entry.template.to_s,
                message: message || value,
                severity: nil,
                kind: kind,
                origin: origin,
                code: code,
                location: entry.location,
                value: value,
                description: description&.call(observed),
                data: { key => observed }
              )
            )
          }
        end

        private

        #: (Symbol, Symbol) -> Array[[Herb::Engine::Runtime::Entry, Array[untyped]]]
        def measurable(key, per)
          found = [] #: Array[[Herb::Engine::Runtime::Entry, Array[untyped]]]

          entries.each do |entry|
            observed = entry[key]

            found << [entry, observed] unless observed.empty?
          end

          return found if per == :render

          merged = {} #: Hash[Array[untyped], [Herb::Engine::Runtime::Entry, Array[untyped]]]

          found.each do |entry, observed|
            position = [entry.template, entry.line, entry.column]
            already = merged[position]

            merged[position] = already ? [already[0], already[1] + observed] : [entry, observed]
          end

          merged.values
        end
      end
    end
  end
end
