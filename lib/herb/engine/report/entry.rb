# frozen_string_literal: true
# typed: true

module Herb
  class Engine
    class Report
      # What was observed at one position in one template while it rendered.
      #
      # A collector puts things here by name, so several can share a position without knowing about
      # each other: a query count and a render time sit side by side under different keys.
      #
      class Entry
        attr_reader :template #: String?
        attr_reader :line #: Integer
        attr_reader :column #: Integer
        attr_reader :observations #: Hash[Symbol, Array[untyped]]

        #: (String?, Integer, Integer) -> void
        def initialize(template, line, column)
          @template = template
          @line = line
          @column = column
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
          Herb::Location.from(line, column, line, column)
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
