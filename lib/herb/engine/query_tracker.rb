# frozen_string_literal: true

require_relative "../../herb"

module Herb
  class Engine
    # Records which ERB tag is rendering, so that queries can be attributed to the tag that caused
    # them. The instrumented calls are emitted by `Herb::Engine::QueryTrackerVisitor`.
    #
    # Outside of a `track` block the calls only maintain a stack, and nothing subscribes to
    # queries, so an instrumented template still renders when ActiveSupport isn't loaded.
    #
    #     report = Herb::Engine::QueryTracker.track { render_the_template }
    #
    #     report.each do |entry|
    #       puts "#{entry.filename}:#{entry.line}:#{entry.column} ran #{entry.count} queries"
    #     end
    #
    class QueryTracker
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
        attr_reader :queries #: Array[String]

        #: (String?, Integer, Integer) -> void
        def initialize(filename, line, column)
          @filename = filename
          @line = line
          @column = column
          @queries = [] #: Array[String]
        end

        #: () -> Integer
        def count
          queries.size
        end

        #: () -> String
        def to_s
          "#{filename || "(unknown)"}:#{line}:#{column} (#{count} #{count == 1 ? "query" : "queries"})"
        end
      end

      EVENT = "sql.active_record"
      IGNORED_NAMES = ["SCHEMA", "TRANSACTION"].freeze

      class << self
        #: () { () -> untyped } -> Array[untyped]
        def track(&)
          previous_entries = @entries
          previous_tracking = @tracking

          @entries = {} #: Hash[[String?, Integer, Integer], Entry]
          @tracking = true

          stack.clear

          subscribed(&)

          report
        ensure
          @entries = previous_entries
          @tracking = previous_tracking

          stack.clear
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

        #: () -> Array[untyped]
        def report
          (@entries || {}).values.sort_by { |entry| [entry.filename.to_s, entry.line, entry.column] }
        end

        #: () -> Array[untyped]
        def stack
          Thread.current[:herb_query_tracker_stack] ||= []
        end

        #: (String) -> void
        def record(sql)
          return unless @tracking

          frame = stack.last
          return unless frame

          entry = (@entries[frame.key] ||= Entry.new(frame.filename, frame.line, frame.column))

          entry.queries << sql

          nil
        end

        private

        def subscribed(&)
          return yield unless notifications

          notifications.subscribed(method(:handle_event), EVENT, &)
        end

        def handle_event(*arguments)
          payload = arguments.last

          return unless payload.is_a?(Hash)
          return if payload[:cached]
          return if IGNORED_NAMES.include?(payload[:name])

          record(payload[:sql].to_s)
        end

        def notifications
          return nil unless defined?(::ActiveSupport::Notifications)

          ::ActiveSupport::Notifications
        end
      end
    end
  end
end
