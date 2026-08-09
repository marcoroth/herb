# frozen_string_literal: true

require_relative "highlighter_bridge"

module Herb
  class Engine
    class ErrorFormatter
      CONTEXT_LINES = 3

      def initialize(source, errors, options = {})
        @source = source
        @errors = errors
        @filename = options[:filename] || "[source]"
        @lines = source.lines
        @bridge = options[:bridge] || HighlighterBridge.new(
          enabled: options.fetch(:use_highlighter, true),
          highlighter_path: options[:highlighter_path]
        )
      end

      def format_all
        return "No errors found" if @errors.empty?

        if @bridge.available?
          format_all_with_highlighter
        else
          format_all_without_highlighter
        end
      end

      def format_all_with_highlighter
        output = String.new
        output << "HTML+ERB Compilation Errors:\n"
        output << ("=" * 60) << "\n\n"

        highlighted_output = @bridge.ansi_diagnostics(
          source: @source,
          errors: @errors,
          filename: @filename,
          context_lines: CONTEXT_LINES
        )

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

            highlighted_basic = @bridge.ansi_focus(
              source: @source,
              line: line_num,
              filename: @filename,
              context_lines: CONTEXT_LINES
            )

            output << (highlighted_basic || format_source_context_basic(line_errors.first))

            output << "\n"
            output << format_suggestions(line_errors)
            output << "\n" unless group_index == errors_by_line.length - 1
          end
        end

        output << "\n" << ("=" * 60) << "\n"
        output << "Total errors: #{@errors.length}\n"
        output << "Compilation failed. Please fix the errors above.\n"

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

        error_name = if error.is_a?(Hash)
                       error[:code] || "UnknownError"
                     else
                       error.class.name.split("::").last.gsub(/Error$/, "")
                     end

        output << "Error ##{number}: #{error_name}\n"
        output << ("-" * 40) << "\n"

        location = error.is_a?(Hash) ? error[:location] : error.location
        if location
          output << "  File: #{@filename}\n"
          output << "  Location: Line #{location.start.line}, Column #{location.start.column}\n"
        end

        error_message = error.is_a?(Hash) ? error[:message] : error.message
        output << "  Message: #{error_message}\n\n"
        output << format_source_context(error) if location
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

        when Herb::Errors::MissingAttributeValueError
          output << "  Attribute: #{error.attribute_name}\n"
          output << "  Suggestion: Add a value after the equals sign or remove the equals sign\n"
        end

        output
      end

      def inline_hint?(error)
        case error
        when Herb::Errors::MissingClosingTagError,
             Herb::Errors::TagNamesMismatchError,
             Herb::Errors::UnclosedElementError,
             Herb::Errors::MissingAttributeValueError
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
        when Herb::Errors::MissingAttributeValueError
          "← Missing attribute value"
        else
          ""
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
        when Herb::Errors::MissingAttributeValueError
          if error.attribute_name
            "Add a value after the equals sign for '#{error.attribute_name}' or remove the equals sign"
          else
            "Add a value after the equals sign or remove the equals sign"
          end
        end
      end
    end
  end
end
