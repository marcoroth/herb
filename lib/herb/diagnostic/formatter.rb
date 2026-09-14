# frozen_string_literal: true
# typed: true

module Herb
  class Diagnostic
    class Formatter
      attr_reader :source #: String
      attr_reader :filename #: (String | Pathname)

      #: (String, Array[Herb::Diagnostic], **untyped) -> void
      def initialize(source, diagnostics, **options)
        @source = source
        @diagnostics = diagnostics
        @filename = options[:filename] || "[source]"
        @lines = source.lines
      end

      #: () -> String
      def summary
        first = @diagnostics.first

        return "No errors found" unless first

        location = first.location
        column = location&.start&.column
        where = [@filename, location&.start&.line, column && (column + 1)].compact.join(":")
        rest = @diagnostics.length - 1
        noun = rest == 1 ? "error" : "errors"
        more = rest.positive? ? " (and #{rest} more #{noun})" : ""

        "#{where}: #{first.message}#{more}"
      end

      #: (?highlight: bool) -> String
      def format_all(highlight: false)
        return "No errors found" if @diagnostics.empty?

        Colors.with_color(highlight) do
          @diagnostics.map { |diagnostic| format_diagnostic(diagnostic) }.join("\n")
        end
      end

      private

      def format_diagnostic(diagnostic)
        output = +""
        output << "#{Colors.red("\u2718")} [#{diagnostic.code || "UnknownError"}] #{diagnostic.message}\n"

        location = diagnostic.location

        if location
          output << "\n"
          output << "    #{Colors.dimmed("#{@filename}:#{location.start.line}:#{location.start.column + 1}:")}\n"
          output << format_source_context(diagnostic)
        end

        details = format_details(diagnostic)
        output << "\n" << details unless details.empty?

        output
      end

      def format_source_context(diagnostic)
        location = diagnostic.location
        line_number = location.start.line
        column_nummber = location.start.column
        line = @lines[line_number - 1].to_s.chomp

        prefix = "      "
        gutter = "#{prefix}#{line_number} \u2502 "
        marker_gutter = "#{prefix}#{" " * line_number.to_s.length} \u2575 "
        span = location.end.column && location.end.column > column_nummber ? location.end.column - column_nummber : 1

        output = +""
        output << Colors.dimmed(gutter) << line << "\n"
        output << Colors.dimmed(marker_gutter) << (" " * column_nummber) << Colors.red("~" * span) << "\n"

        output
      end

      def format_details(diagnostic)
        suggestion = diagnostic.suggestion

        suggestion ? "  #{suggestion}\n" : ""
      end
    end
  end
end
