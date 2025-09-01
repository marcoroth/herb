# frozen_string_literal: true

require "json"
require "time"
require "pathname"

require_relative "engine/debug_visitor"
require_relative "engine/compiler"
require_relative "engine/error_formatter"
require_relative "engine/validation_errors"
require_relative "engine/parser_error_overlay"
require_relative "engine/validation_error_overlay"
require_relative "engine/validators/security_validator"
require_relative "engine/validators/nesting_validator"
require_relative "engine/validators/accessibility_validator"

module Herb
  class Engine
    attr_reader :src, :filename, :project_path, :relative_file_path, :bufvar, :debug, :content_for_head,
                :validation_error_template

    ESCAPE_TABLE = {
      "&" => "&amp;",
      "<" => "&lt;",
      ">" => "&gt;",
      '"' => "&quot;",
      "'" => "&#39;",
    }.freeze

    class CompilationError < StandardError
    end

    def initialize(input, properties = {})
      @filename = properties[:filename] ? ::Pathname.new(properties[:filename]) : nil
      @project_path = ::Pathname.new(properties[:project_path] || Dir.pwd)

      if @filename
        absolute_filename = @filename.absolute? ? @filename : @project_path + @filename
        @relative_file_path = absolute_filename.relative_path_from(@project_path).to_s
      else
        @relative_file_path = "unknown"
      end

      @bufvar = properties[:bufvar] || properties[:outvar] || "_buf"
      @escape = properties.fetch(:escape) { properties.fetch(:escape_html, false) }
      @escapefunc = properties[:escapefunc]
      @src = properties[:src] || String.new
      @chain_appends = properties[:chain_appends]
      @buffer_on_stack = false
      @debug = properties.fetch(:debug, false)
      @content_for_head = properties[:content_for_head]
      @validation_error_template = nil
      @validation_mode = properties.fetch(:validation_mode, :raise)

      unless [:raise, :overlay, :none].include?(@validation_mode)
        raise ArgumentError,
              "validation_mode must be one of :raise, :overlay, or :none, got #{@validation_mode.inspect}"
      end

      @escapefunc ||= if @escape
                        "__herb.h"
                      else
                        "::Herb::Engine.h"
                      end

      @freeze = properties[:freeze]
      @freeze_template_literals = properties.fetch(:freeze_template_literals, true)
      @text_end = @freeze_template_literals ? "'.freeze" : "'"

      bufval = properties[:bufval] || "::String.new"
      preamble = properties[:preamble] || "#{@bufvar} = #{bufval};"
      postamble = properties[:postamble] || "#{@bufvar}.to_s\n"

      @src << "# frozen_string_literal: true\n" if @freeze

      if properties[:ensure]
        @src << "begin; __original_outvar = #{@bufvar}"
        @src << if /\A@[^@]/ =~ @bufvar
                  "; "
                else
                  " if defined?(#{@bufvar}); "
                end
      end

      @src << "__herb = ::Herb::Engine; " if @escape && @escapefunc == "__herb.h"

      @src << preamble
      @src << "\n" unless preamble.end_with?("\n")

      parse_result = ::Herb.parse(input)
      ast = parse_result.value
      parser_errors = parse_result.errors

      if parser_errors.any?
        case @validation_mode
        when :raise
          handle_parser_errors(parser_errors, input, ast)
          return
        when :overlay
          add_parser_error_overlay(parser_errors, input)
        when :none
          # Skip both errors and compilation, but still need minimal Ruby code
        end
      else
        validation_errors = run_validation(ast) unless @validation_mode == :none
        all_errors = parser_errors + (validation_errors || [])

        handle_validation_errors(all_errors, input) if @validation_mode == :raise && all_errors.any?

        add_validation_overlay(validation_errors, input) if @validation_mode == :overlay && validation_errors&.any?

        if @debug
          debug_visitor = DebugVisitor.new(self)
          ast.accept(debug_visitor)
        end

        compiler = Compiler.new(self, properties)
        ast.accept(compiler)

        compiler.generate_output
      end

      if @validation_error_template
        escaped_html = @validation_error_template.gsub("'", "\\\\'")
        @src << " #{@bufvar} << ('#{escaped_html}'.html_safe).to_s;"
      end

      @src << "\n" unless @src.end_with?("\n")
      send(:add_postamble, postamble)

      @src << "; ensure\n  #{@bufvar} = __original_outvar\nend\n" if properties[:ensure]

      @src.freeze
      freeze
    end

    def self.h(value)
      value.to_s.gsub(/[&<>"']/, ESCAPE_TABLE)
    end

    def self.attr(value)
      value.to_s
           .gsub("&", "&amp;")
           .gsub('"', "&quot;")
           .gsub("'", "&#39;")
           .gsub("<", "&lt;")
           .gsub(">", "&gt;")
           .gsub("\n", "&#10;")
           .gsub("\r", "&#13;")
           .gsub("\t", "&#9;")
    end

    def self.js(value)
      value.to_s.gsub(/[\\'"<>&\n\r\t\f\b]/) do |char|
        case char
        when "\n" then "\\n"
        when "\r" then "\\r"
        when "\t" then "\\t"
        when "\f" then "\\f"
        when "\b" then "\\b"
        else
          "\\x#{char.ord.to_s(16).rjust(2, "0")}"
        end
      end
    end

    def self.css(value)
      value.to_s.gsub(/[^\w-]/) do |char|
        "\\#{char.ord.to_s(16).rjust(6, "0")}"
      end
    end

    protected

    def add_text(text)
      return if text.empty?

      text = text.gsub(/['\\]/, '\\\\\&')

      with_buffer { @src << " << '" << text << @text_end }
    end

    def add_code(code)
      terminate_expression

      @src << " " << code
      @src << ";" unless code[-1] == "\n"
      @buffer_on_stack = false
    end

    def add_expression(indicator, code)
      if (indicator == "=") ^ @escape
        add_expression_result(code)
      else
        add_expression_result_escaped(code)
      end
    end

    def add_expression_result(code)
      with_buffer { @src << " << (" << code << ").to_s" }
    end

    def add_expression_result_escaped(code)
      with_buffer { @src << " << " << @escapefunc << "((" << code << "))" }
    end

    def add_expression_block(indicator, code)
      if (indicator == "=") ^ @escape
        add_expression_block_result(code)
      else
        add_expression_block_result_escaped(code)
      end
    end

    def add_expression_block_result(code)
      with_buffer { @src << " << " << code }
    end

    def add_expression_block_result_escaped(code)
      with_buffer { @src << " << " << @escapefunc << "(" << code << ")" }
    end

    def add_postamble(postamble)
      terminate_expression
      @src << postamble
    end

    def with_buffer(&_block)
      if @chain_appends
        @src << "; " << @bufvar unless @buffer_on_stack
        yield
        @buffer_on_stack = true
      else
        @src << " " << @bufvar
        yield
        @src << ";"
      end
    end

    def terminate_expression
      @src << "; " if @chain_appends && @buffer_on_stack
    end

    private

    def run_validation(ast)
      validators = [
        Validators::SecurityValidator.new,
        Validators::NestingValidator.new,
        Validators::AccessibilityValidator.new
      ]

      errors = [] #: Array[untyped]

      validators.each do |validator|
        ast.accept(validator)
        errors.concat(validator.errors)
      end

      errors
    end

    def handle_parser_errors(parser_errors, input, _ast)
      case @validation_mode
      when :raise
        formatter = ErrorFormatter.new(input, parser_errors, filename: @filename)
        message = formatter.format_all

        raise CompilationError, "\n#{message}"
      when :overlay
        add_parser_error_overlay(parser_errors, input)
        @src << "\n" unless @src.end_with?("\n")
        send(:add_postamble, "#{@bufvar}.to_s\n")
      when :none
        @src << "\n" unless @src.end_with?("\n")
        send(:add_postamble, "#{@bufvar}.to_s\n")
      end
    end

    def handle_validation_errors(errors, input)
      return unless errors.any?

      security_error = errors.find { |error|
        error.is_a?(Hash) && error[:source] == "SecurityValidator"
      }

      if security_error
        line = security_error[:location]&.start&.line
        column = security_error[:location]&.start&.column
        suggestion = security_error[:suggestion]

        raise SecurityError.new(
          security_error[:message],
          line: line,
          column: column,
          filename: @filename,
          suggestion: suggestion
        )
      end

      formatter = ErrorFormatter.new(input, errors, filename: @filename)
      message = formatter.format_all
      raise CompilationError, "\n#{message}"
    end

    def add_validation_overlay(errors, input = nil)
      return unless errors.any?

      templates = errors.map { |error|
        location = error[:location]
        line = location&.start&.line || 0
        column = location&.start&.column || 0

        source = input || @src
        overlay_generator = ValidationErrorOverlay.new(source, error, filename: @relative_file_path)
        html_fragment = overlay_generator.generate_fragment

        escaped_message = escape_attr(error[:message])
        escaped_suggestion = error[:suggestion] ? escape_attr(error[:suggestion]) : ""

        <<~TEMPLATE
          <template
            data-herb-validation-error
            data-severity="#{error[:severity]}"
            data-source="#{error[:source]}"
            data-code="#{error[:code]}"
            data-line="#{line}"
            data-column="#{column}"
            data-filename="#{escape_attr(@relative_file_path)}"
            data-message="#{escaped_message}"
            #{"data-suggestion=\"#{escaped_suggestion}\"" if error[:suggestion]}
            data-timestamp="#{Time.now.iso8601}"
          >#{html_fragment}</template>
        TEMPLATE
      }.join

      @validation_error_template = templates
    end

    def escape_attr(text)
      text.to_s
          .gsub("&", "&amp;")
          .gsub('"', "&quot;")
          .gsub("'", "&#39;")
          .gsub("<", "&lt;")
          .gsub(">", "&gt;")
          .gsub("\n", "&#10;")
          .gsub("\r", "&#13;")
          .gsub("\t", "&#9;")
    end

    def add_parser_error_overlay(parser_errors, input)
      return unless parser_errors.any?

      overlay_generator = ParserErrorOverlay.new(
        input,
        parser_errors,
        filename: @relative_file_path
      )

      error_html = overlay_generator.generate_html
      escaped_html = error_html.gsub("'", "\\'")
      @validation_error_template = "<template data-herb-parser-error>#{escaped_html}</template>"
    end
  end
end
