# frozen_string_literal: true
# typed: false

require_relative "../diagnostic"

module Herb
  class Engine
    class CompilationError < StandardError
      attr_reader :details, :diagnostics

      def initialize(message, details: nil, diagnostics: [])
        @details = details
        @diagnostics = diagnostics

        super(message)
      end

      def detailed_message(highlight: false, **)
        report = formatted_errors(highlight: highlight)

        return super unless report

        "#{super}\n\n#{report}"
      end

      def formatted_errors(highlight: false)
        @details&.format_all(highlight: highlight)
      end
    end

    class GeneratorTemplateError < CompilationError
    end

    class InvalidRubyError < CompilationError
      attr_reader :compiled_source

      def initialize(message, compiled_source: nil)
        @compiled_source = compiled_source

        super(message)
      end
    end

    class SecurityError < StandardError
      attr_reader :line, :column, :filename, :suggestion

      def initialize(message, line: nil, column: nil, filename: nil, suggestion: nil)
        @line = line
        @column = column
        @filename = filename
        @suggestion = suggestion

        super(build_error_message(message))
      end

      private

      def build_error_message(message)
        parts = [] #: Array[String]

        if @filename || (@line && @column)
          location_parts = [] #: Array[String]

          location_parts << @filename if @filename
          location_parts << "#{@line}:#{@column}" if @line && @column

          parts << location_parts.join(":")
        end

        parts << message

        parts << "Suggestion: #{@suggestion}" if @suggestion

        parts.join(" - ")
      end
    end

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
