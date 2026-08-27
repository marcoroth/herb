# frozen_string_literal: true
# typed: false

module Herb
  class Engine
    class CompilationError < StandardError
      attr_reader :details
      attr_reader :diagnostics

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
  end
end
