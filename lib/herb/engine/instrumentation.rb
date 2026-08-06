# frozen_string_literal: true

require_relative "../../herb"

module Herb
  class Engine
    # Records which ERB tag is rendering, so that what happens during a render can be attributed
    # to the tag that caused it. The calls are emitted by `Herb::Engine::InstrumentationVisitor`.
    #
    # An instrumented template only ever calls `rendering`, `at`, `enter` and `leave`. What gets
    # collected is decided at render time, so adding a collector never requires recompiling a
    # template, and outside of `track` the calls do almost nothing.
    #
    #     require "herb/engine/instrumentation"
    #     require "herb/engine/instrumentation/query_collector"
    #
    #     collectors = [Herb::Engine::Instrumentation::QueryCollector.new]
    #
    #     report = Herb::Engine::Instrumentation.track(collectors: collectors) { render_the_template }
    #
    #     report.each { |entry| puts entry }
    #
    class Instrumentation
      class Frame
        attr_reader :filename #: String?
        attr_reader :line #: Integer
        attr_reader :column #: Integer

        #: (String?, Integer, Integer) -> void
        def initialize(filename, line, column)
          @filename = filename
          @line = line
          @column = column
        end

        #: () -> [String?, Integer, Integer]
        def key
          [filename, line, column]
        end
      end

      class Entry
        attr_reader :filename #: String?
        attr_reader :line #: Integer
        attr_reader :column #: Integer
        attr_reader :observations #: Hash[Symbol, Array[untyped]]

        #: (String?, Integer, Integer) -> void
        def initialize(filename, line, column)
          @filename = filename
          @line = line
          @column = column
          @observations = {} #: Hash[Symbol, Array[untyped]]
        end

        #: (Symbol) -> Array[untyped]
        def [](key)
          observations.fetch(key, [])
        end

        #: (Symbol, untyped) -> void
        def record(key, value)
          (observations[key] ||= []) << value

          nil
        end

        #: () -> Integer
        def count
          observations.values.sum { |values| values.size } # rubocop:disable Style/SymbolProc
        end

        #: () -> String
        def to_s
          summary = observations.map { |key, values| "#{values.size} #{key}" }.join(", ")

          "#{filename || "(unknown)"}:#{line}:#{column} (#{summary})"
        end
      end

      class << self
        #: (untyped) -> Array[untyped]
        def register(collector)
          collector.attach if collector.respond_to?(:attach)

          registered << collector
        end

        #: () -> Array[untyped]
        def registered
          @registered ||= [] #: Array[untyped]
        end

        #: () -> void
        def unregister_all
          registered.each { |collector| collector.detach if collector.respond_to?(:detach) }

          registered.clear

          nil
        end

        #: (?collectors: Array[untyped]) -> void
        def start(collectors: [])
          state[:entries] = {}
          state[:collectors] = registered + collectors
          state[:stack] = []

          nil
        end

        #: () -> Array[untyped]
        def finish
          collected = report

          state[:entries] = nil
          state[:collectors] = nil
          state[:stack] = []

          collected
        end

        #: (?collectors: Array[untyped]) { () -> untyped } -> Array[untyped]
        def track(collectors: [], &)
          start(collectors: collectors)

          attached(collectors, &)

          report
        ensure
          finish
        end

        #: (String?) -> void
        def rendering(identifier)
          return unless tracking?

          each_collector { |collector| collector.rendering(identifier) if collector.respond_to?(:rendering) }

          nil
        end

        #: (String?, Integer, Integer) { () -> untyped } -> untyped
        def at(filename, line, column)
          enter(filename, line, column)

          yield
        ensure
          leave
        end

        #: (String?, Integer, Integer) -> void
        def enter(filename, line, column)
          stack.push(Frame.new(filename, line, column))

          nil
        end

        #: () -> void
        def leave
          stack.pop

          nil
        end

        #: (Symbol, untyped) -> void
        def record(key, value)
          return unless tracking?

          frame = stack.last

          return unless frame

          entries = state[:entries] #: Hash[[String?, Integer, Integer], Entry]
          entry = (entries[frame.key] ||= Entry.new(frame.filename, frame.line, frame.column))

          entry.record(key, value)

          nil
        end

        #: () -> Array[untyped]
        def report
          (state[:entries] || {}).values.sort_by { |entry| [entry.filename.to_s, entry.line, entry.column] }
        end

        #: () -> Array[untyped]
        def stack
          state[:stack] ||= []
        end

        #: () -> bool
        def tracking?
          !state[:entries].nil?
        end

        #: () -> Hash[Symbol, untyped]
        def state
          Thread.current[:herb_instrumentation] ||= {} #: Hash[Symbol, untyped]
        end

        private

        def each_collector(&)
          (state[:collectors] || registered).each(&)
        end

        def attached(collectors, &block)
          return yield if collectors.empty?

          rest = collectors[1..] || []

          collectors.first.attach { attached(rest, &block) }
        end
      end
    end
  end
end
