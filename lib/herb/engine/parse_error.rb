# frozen_string_literal: true
# typed: true

require_relative "errors"
require_relative "../diagnostic"

module Herb
  class Engine
    class ParseError < CompilationError
      CONTEXT_LINES = 3 #: Integer

      attr_reader :source #: String
      attr_reader :visitors #: Array[String]
      attr_reader :parser_options #: Hash[Symbol, untyped]
      attr_reader :filename #: String?

      #: (String, diagnostics: Array[Herb::Diagnostic], source: String, ?filename: String?, ?visitors: Array[String], ?parser_options: Hash[Symbol, untyped], ?details: untyped) -> void
      def initialize(message, diagnostics:, source:, filename: nil, visitors: [], parser_options: {}, details: nil)
        @diagnostics = diagnostics
        @source = source
        @visitors = visitors
        @parser_options = parser_options
        @filename = filename

        super(message, details: details, diagnostics: diagnostics)
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
