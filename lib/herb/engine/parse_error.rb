# frozen_string_literal: true
# typed: true

require_relative "errors"
require_relative "../diagnostic"

module Herb
  class Engine
    class ParseError < CompilationError
      CONTEXT_LINES = 3 #: Integer

      attr_reader :diagnostics #: Array[Herb::Diagnostic]
      attr_reader :source #: String
      attr_reader :filename #: String?

      # The visitors that were on the stack when this was raised, by name. Which validators ran is
      # part of why a template failed the way it did, and it is known only here, so it travels with
      # the error rather than being asked for again later.
      attr_reader :visitors #: Array[String]

      #: (String, diagnostics: Array[Herb::Diagnostic], source: String, ?filename: String?, ?visitors: Array[String]) -> void
      def initialize(message, diagnostics:, source:, filename: nil, visitors: [])
        @diagnostics = diagnostics
        @source = source
        @filename = filename
        @visitors = visitors

        super(message)
      end

      #: () -> Integer?
      def line_number
        location = diagnostics.first&.location

        location&.start&.line
      end

      #: () -> Array[String]
      def annotated_source_code
        line = line_number

        return [] unless line

        lines = source.lines
        first = [line - CONTEXT_LINES, 1].max
        last = [line + CONTEXT_LINES, lines.length].min

        (first..last).map { |number|
          format("%<number>5d  %<line>s", number: number, line: lines[number - 1].to_s.chomp)
        }
      end
    end
  end
end
