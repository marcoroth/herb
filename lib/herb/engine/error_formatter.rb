# frozen_string_literal: true

require "English"
require "tempfile"

module Herb
  class Engine
    class ErrorFormatter
      CONTEXT_LINES = 3

      def initialize(source, errors, options = {})
        @source = source
        @errors = errors
        @filename = options[:filename] || "[source]"
        @lines = source.lines
        @use_highlighter = options.fetch(:use_highlighter, true)
        @highlighter_path = options[:highlighter_path] || find_highlighter_path
      end

      def format_all
        return "No errors found" if @errors.empty?

        if @use_highlighter && @highlighter_path && can_use_highlighter?
          format_all_with_highlighter
        else
          format_all_without_highlighter
        end
      end

      def format_all_with_highlighter
        output = String.new
        output << "HTML+ERB Compilation Errors:\n"
        output << ("=" * 60) << "\n\n"

        require "tempfile"
        temp_file = Tempfile.new(["herb_error", ".html.erb"])
        temp_file.write(@source)
        temp_file.close

        begin
          highlighted_output = run_highlighter_with_diagnostics(temp_file.path, CONTEXT_LINES)

          if highlighted_output
            output << highlighted_output
          else
            errors_by_line = @errors.group_by do |error|
              location = error.is_a?(Hash) ? error[:location] : error.location
              location&.start&.line
            end.compact

            errors_by_line.each_with_index do |(line_num, line_errors), group_index|
              output << "Error Group ##{group_index + 1} (Line #{line_num}):\n"
              output << ("-" * 40) << "\n"

              line_errors.each_with_index do |error, index|
                output << format_error_header(error, index + 1)
              end

              output << "\nSource Context:\n"

              highlighted_basic = run_highlighter(temp_file.path, line_num, CONTEXT_LINES)

              output << (highlighted_basic || format_source_context_basic(line_errors.first))

              output << "\n"
              output << format_suggestions(line_errors)
              output << "\n" unless group_index == errors_by_line.length - 1
            end
          end

          output << "\n" << ("=" * 60) << "\n"
          output << "Total errors: #{@errors.length}\n"
          output << "Compilation failed. Please fix the errors above.\n"
        ensure
          temp_file.unlink
        end

        output
      end

      def format_all_without_highlighter
        output = String.new
        output << "HTML+ERB Compilation Errors:\n"
        output << ("=" * 60) << "\n\n"

        @errors.each_with_index do |error, index|
          output << format_error(error, index + 1)
          output << "\n" unless index == @errors.length - 1
        end

        output << "\n" << ("=" * 60) << "\n"
        output << "Total errors: #{@errors.length}\n"
        output << "Compilation failed. Please fix the errors above.\n"

        output
      end

      def format_error(error, number)
        output = String.new

        output << "Error ##{number}: #{error.class.name.split("::").last.gsub(/Error$/, "")}\n"
        output << ("-" * 40) << "\n"

        if error.location
          output << "  File: #{@filename}\n"
          output << "  Location: Line #{error.location.start.line}, Column #{error.location.start.column}\n"
        end

        output << "  Message: #{error.message}\n\n"
        output << format_source_context(error) if error.location
        output << format_error_details(error)

        output
      end

      private

      def format_source_context(error)
        output = String.new
        location = error.is_a?(Hash) ? error[:location] : error.location
        line_num = location.start.line
        col_num = location.start.column

        start_line = [line_num - CONTEXT_LINES, 1].max
        end_line = [line_num + CONTEXT_LINES, @lines.length].min

        output << "  Source:\n"

        (start_line..end_line).each do |i|
          line = @lines[i - 1]
          line_str = line.chomp
          line_prefix = format("  %4d | ", i)

          if i == line_num
            output << "\e[31m"
            output << line_prefix
            output << line_str
            output << "\e[0m\n"

            if col_num.positive?
              pointer = "#{" " * (line_prefix.length + col_num - 1)}^"

              if location.end.column && location.end.column > col_num
                underline_length = location.end.column - col_num
                pointer << ("~" * [underline_length - 1, 0].max)
              end

              output << "\e[31m#{pointer}\e[0m"

              output << " #{format_inline_hint(error)}" if inline_hint?(error)
              output << "\n"
            end
          else
            output << "\e[90m"
            output << line_prefix
            output << line_str
            output << "\e[0m\n"
          end
        end

        output << "\n"
        output
      end

      def format_error_details(error)
        output = String.new

        case error
        when Herb::Errors::MissingClosingTagError
          if error.opening_tag
            output << "  Opening tag: <#{error.opening_tag.value}> at line #{error.opening_tag.location.start.line}\n"
            output << "  Expected: </#{error.opening_tag.value}>\n"
            output << "  Suggestion: Add the closing tag or use a self-closing tag\n"
          end

        when Herb::Errors::MissingOpeningTagError
          if error.closing_tag
            output << "  Closing tag: </#{error.closing_tag.value}> at line #{error.closing_tag.location.start.line}\n"
            output << "  Suggestion: Add the corresponding opening tag or remove this closing tag\n"
          end

        when Herb::Errors::TagNamesMismatchError
          if error.opening_tag && error.closing_tag
            output << "  Opening tag: <#{error.opening_tag.value}> at line #{error.opening_tag.location.start.line}\n"
            output << "  Closing tag: </#{error.closing_tag.value}> at line #{error.closing_tag.location.start.line}\n"
            output << "  Suggestion: Change the closing tag to </#{error.opening_tag.value}>\n"
          end

        when Herb::Errors::VoidElementClosingTagError
          if error.tag_name
            output << "  Void element: <#{error.tag_name.value}>\n"
            output << "  Note: Void elements like <br>, <img>, <input> cannot have closing tags\n"
            output << "  Suggestion: Remove the closing tag or use <#{error.tag_name.value} />\n"
          end

        when Herb::Errors::UnclosedElementError
          if error.opening_tag
            output << "  Opening tag: <#{error.opening_tag.value}> at line #{error.opening_tag.location.start.line}\n"
            output << "  Note: This element was never closed before the end of the document\n"
            output << "  Suggestion: Add </#{error.opening_tag.value}> before the end of the template\n"
          end

        when Herb::Errors::RubyParseError
          output << "  Ruby error: #{error.diagnostic_id}\n"
          output << "  Level: #{error.level}\n"
          output << "  Details: #{error.error_message}\n"
          output << "  Suggestion: Check your Ruby syntax inside the ERB tag\n"

        when Herb::Errors::QuotesMismatchError
          if error.opening_quote && error.closing_quote
            output << "  Opening quote: #{error.opening_quote.value}\n"
            output << "  Closing quote: #{error.closing_quote.value}\n"
            output << "  Suggestion: Use matching quotes for attribute values\n"
          end
        end

        output
      end

      def inline_hint?(error)
        case error
        when Herb::Errors::MissingClosingTagError,
             Herb::Errors::TagNamesMismatchError,
             Herb::Errors::UnclosedElementError
          true
        else
          false
        end
      end

      def format_inline_hint(error)
        case error
        when Herb::Errors::MissingClosingTagError
          "← Missing closing tag"
        when Herb::Errors::TagNamesMismatchError
          "← Tag mismatch"
        when Herb::Errors::UnclosedElementError
          "← Unclosed element"
        else
          ""
        end
      end

      def find_highlighter_path
        possible_paths = [
          File.expand_path("../../../javascript/packages/highlighter/bin/herb-highlight", __dir__ || "."),
          "herb-highlight" # In PATH
        ]

        possible_paths.find { |path| File.executable?(path) || system("which #{path} > /dev/null 2>&1") }
      end

      def can_use_highlighter?
        return false unless @highlighter_path
        return false unless File.exist?(@highlighter_path) || system("which #{@highlighter_path} > /dev/null 2>&1")

        system("node --version > /dev/null 2>&1")
      end

      def run_highlighter(file_path, line_num, context_lines)
        return nil unless @highlighter_path && can_use_highlighter?

        cmd = "#{@highlighter_path} --focus #{line_num} --context-lines #{context_lines} \"#{file_path}\""

        begin
          output = `#{cmd} 2>/dev/null`
          status = $CHILD_STATUS
          return output.gsub(file_path, @filename) if status&.success? && !output.strip.empty?
        rescue StandardError
          # Silently fall back to basic formatting if highlighter fails
        end

        nil
      end

      def run_highlighter_with_diagnostics(file_path, context_lines = 2)
        return nil unless @highlighter_path && can_use_highlighter?

        diagnostics = @errors.map { |error| herb_error_to_diagnostic(error) }

        require "tempfile"
        require "json"

        diagnostics_file = Tempfile.new(["herb_diagnostics", ".json"])
        diagnostics_file.write(JSON.pretty_generate(diagnostics))
        diagnostics_file.close

        begin
          cmd = "#{@highlighter_path} --diagnostics \"#{diagnostics_file.path}\" --split-diagnostics --context-lines #{context_lines} \"#{file_path}\""

          output = `#{cmd} 2>/dev/null`
          status = $CHILD_STATUS

          return output.gsub(file_path, @filename) if status&.success? && !output.strip.empty?
        rescue StandardError
          # Silently fall back to basic formatting if highlighter fails
        ensure
          diagnostics_file.unlink
        end

        nil
      end

      def herb_error_to_diagnostic(error)
        if error.is_a?(Hash)
          location = error[:location]
          {
            message: error[:message],
            location: {
              start: {
                line: location&.start&.line || 1,
                column: location&.start&.column || 1,
              },
              end: {
                line: location&.end&.line || location&.start&.line || 1,
                column: location&.end&.column || location&.start&.column || 1,
              },
            },
            severity: error[:severity] || "error",
            code: error[:code] || "UnknownError",
            source: error[:source] || "herb-validator",
          }
        else
          severity = case error
                     when Herb::Errors::RubyParseError
                       error.level == "error" ? "error" : "warning"
                     else
                       "error"
                     end

          {
            message: error.message,
            location: {
              start: {
                line: error.location&.start&.line || 1,
                column: error.location&.start&.column || 1,
              },
              end: {
                line: error.location&.end&.line || error.location&.start&.line || 1,
                column: error.location&.end&.column || error.location&.start&.column || 1,
              },
            },
            severity: severity,
            code: error.class.name.split("::").last.gsub(/Error$/, ""),
            source: "herb-compiler",
          }
        end
      end

      def format_error_header(error, number)
        output = String.new
        output << if error.is_a?(Hash)
                    "  #{number}. #{error[:code] || "UnknownError"}: #{error[:message]}\n"
                  else
                    "  #{number}. #{error.class.name.split("::").last.gsub(/Error$/, "")}: #{error.message}\n"
                  end

        location = error.is_a?(Hash) ? error[:location] : error.location
        output << "     Location: Line #{location.start.line}, Column #{location.start.column}\n" if location

        output
      end

      def format_suggestions(errors)
        output = String.new
        output << "Suggestions:\n"

        errors.each do |error|
          suggestion = get_error_suggestion(error)
          output << "  • #{suggestion}\n" if suggestion
        end

        output
      end

      def format_source_context_basic(error)
        format_source_context(error)
      end

      def get_error_suggestion(error)
        case error
        when Herb::Errors::MissingClosingTagError
          if error.opening_tag
            "Add </#{error.opening_tag.value}> to close the opening tag"
          else
            "Add the missing closing tag"
          end
        when Herb::Errors::MissingOpeningTagError
          if error.closing_tag
            "Add <#{error.closing_tag.value}> before the closing tag"
          else
            "Add the missing opening tag"
          end
        when Herb::Errors::TagNamesMismatchError
          if error.opening_tag && error.closing_tag
            "Change </#{error.closing_tag.value}> to </#{error.opening_tag.value}>"
          else
            "Fix the tag name mismatch"
          end
        when Herb::Errors::VoidElementClosingTagError
          if error.tag_name
            "Remove the closing tag for void element <#{error.tag_name.value}>"
          else
            "Remove the closing tag for this void element"
          end
        when Herb::Errors::UnclosedElementError
          if error.opening_tag
            "Add </#{error.opening_tag.value}> before the end of the template"
          else
            "Close the unclosed element"
          end
        when Herb::Errors::RubyParseError
          "Check your Ruby syntax inside the ERB tag"
        when Herb::Errors::QuotesMismatchError
          "Use matching quotes for attribute values"
        end
      end
    end
  end
end
