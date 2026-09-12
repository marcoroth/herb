# frozen_string_literal: true
# typed: true

module Herb
  class Engine
    module Runtime
      # What was observed at one position in one template while it rendered.
      #
      # A collector puts things here by name, so several can share a position without knowing about
      # each other: a query count and a render time sit side by side under different keys.
      #
      class Entry
        attr_reader :template #: String?
        attr_reader :line #: Integer
        attr_reader :column #: Integer
        attr_reader :end_line #: Integer?
        attr_reader :end_column #: Integer?
        attr_reader :observations #: Hash[Symbol, Array[untyped]]

        #: (String?, Integer, Integer, ?Integer?, ?Integer?) -> void
        def initialize(template, line, column, end_line = nil, end_column = nil)
          @template = template
          @line = line
          @column = column
          @end_line = end_line
          @end_column = end_column
          @observations = {} #: Hash[Symbol, Array[untyped]]
        end

        #: (Symbol, untyped) -> void
        def observe(key, value)
          (observations[key] ||= []) << value

          nil
        end

        #: (Symbol) -> Array[untyped]
        def [](key)
          observations.fetch(key, [])
        end

        #: () -> bool
        def empty?
          observations.empty?
        end

        #: () -> Herb::Location
        def location
          Herb::Location.from(line, column, end_line || line, end_column || column)
        end

        #: () -> String
        def to_s
          summary = observations.map { |key, values| "#{values.size} #{key}" }.join(", ")
          position = location.start.to_one_based

          "#{template || "(unknown)"}:#{position[:line]}:#{position[:column]} (#{summary})"
        end
      end
    end
  end
end
