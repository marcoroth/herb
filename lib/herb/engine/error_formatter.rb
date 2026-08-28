# frozen_string_literal: true
# typed: true

module Herb
  class Engine
    class ErrorFormatter
      attr_reader :source #: String
      attr_reader :filename #: (String | Pathname)

      def initialize(source, errors, options = {})
        @source = source
        @errors = errors
        @filename = options[:filename] || "[source]"
        @lines = source.lines
      end

      #: () -> String
      def summary
        first = @errors.first

        return "No errors found" unless first

        location = first.location
        column = location&.start&.column
        where = [@filename, location&.start&.line, column && (column + 1)].compact.join(":")
        rest = @errors.length - 1
        noun = rest == 1 ? "error" : "errors"
        more = rest.positive? ? " (and #{rest} more #{noun})" : ""

        "#{where}: #{first.message}#{more}"
      end

      #: (?highlight: bool) -> String
      def format_all(highlight: false)
        return "No errors found" if @errors.empty?

        Colors.with_color(highlight) do
          @errors.map { |error| format_error(error) }.join("\n")
        end
      end

      private

      def format_error(error)
        output = String.new
        output << "#{Colors.red("\u2718")} [#{error_name(error)}] #{error.message}\n"

        location = error.location

        if location
          output << "\n"
          output << "    #{Colors.dimmed("#{@filename}:#{location.start.line}:#{location.start.column + 1}:")}\n"
          output << format_source_context(error)
        end

        details = format_error_details(error)
        output << "\n" << details unless details.empty?

        output
      end

      def error_name(error)
        if error.is_a?(Herb::Diagnostic)
          error.code || "UnknownError"
        else
          error.class.name.split("::").last.gsub(/Error$/, "")
        end
      end

      def format_source_context(error)
        location = error.location
        line_num = location.start.line
        col_num = location.start.column
        line_str = @lines[line_num - 1].to_s.chomp

        gutter = "      #{line_num} \u2502 "
        marker_gutter = "      #{" " * line_num.to_s.length} \u2575 "

        span = if location.end.column && location.end.column > col_num
                 location.end.column - col_num
               else
                 1
               end

        output = String.new
        output << Colors.dimmed(gutter) << line_str << "\n"
        output << Colors.dimmed(marker_gutter) << (" " * col_num) << Colors.red("~" * span) << "\n"

        output
      end

      def format_error_details(error)
        suggestion = error.respond_to?(:suggestion) ? error.suggestion : nil

        suggestion ? "  #{suggestion}\n" : ""
      end
    end
  end
end
