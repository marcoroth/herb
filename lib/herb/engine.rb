# frozen_string_literal: true

require_relative "engine/compiler"
require_relative "engine/error_formatter"
require_relative "engine/validator"

module Herb
  class Engine
    attr_reader :src, :filename, :bufvar

    RANGE_FIRST = 0
    RANGE_LAST = -1

    class CompilationError < StandardError
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
        parts = []

        if @filename || (@line && @column)
          location_parts = []

          location_parts << @filename if @filename
          location_parts << "#{@line}:#{@column}" if @line && @column

          parts << location_parts.join(":")
        end

        parts << message

        if @suggestion
          parts << "Suggestion: #{@suggestion}"
        end

        parts.join(" - ")
      end
    end

    def initialize(input, properties = {})
      @filename = properties[:filename]
      @bufvar = properties[:bufvar] || properties[:outvar] || "_buf"
      @escape = properties.fetch(:escape) { properties.fetch(:escape_html, false) }
      @escapefunc = properties[:escapefunc]
      @src = properties[:src] || String.new
      @chain_appends = properties[:chain_appends]
      @buffer_on_stack = false

      unless @escapefunc
        if @escape
          @escapefunc = "__herb.h"
        else
          @escapefunc = "::Herb::Engine.h"
        end
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
        if /\A@[^@]/ =~ @bufvar
          @src << "; "
        else
          @src << " if defined?(#{@bufvar}); "
        end
      end

      if @escape && @escapefunc == "__herb.h"
        @src << "__herb = ::Herb::Engine; "
      end

      @src << preamble
      @src << "\n" unless preamble.end_with?("\n")

      parse_result = ::Herb.parse(input)
      ast = parse_result.value
      errors = parse_result.errors

      validator = Validator.new
      ast.accept(validator)
      errors.concat(validator.errors)

      if errors.any?
        formatter = ErrorFormatter.new(input, errors, filename: @filename)
        message = formatter.format_all
        raise CompilationError, "\n#{message}"
      end

      compiler = Compiler.new(self, properties)
      ast.accept(compiler)

      compiler.generate_output

      @src << "\n" unless @src.end_with?("\n")
      send(:add_postamble, postamble)

      if properties[:ensure]
        @src << "; ensure\n  #{@bufvar} = __original_outvar\nend\n"
      end

      @src.freeze
      freeze
    end

    protected

    def add_text(text)
      return if text.empty?

      text = text.gsub(/['\\]/, '\\\\\&')

      with_buffer { @src << " << '" << text << @text_end }
    end

    def add_code(code)
      terminate_expression

      @src << ' ' << code
      @src << ';' unless code[RANGE_LAST] == "\n"
      @buffer_on_stack = false
    end

    def add_expression(indicator, code)
      if ((indicator == '=') ^ @escape)
        add_expression_result(code)
      else
        add_expression_result_escaped(code)
      end
    end

    def add_expression_result(code)
      with_buffer { @src << ' << (' << code << ').to_s' }
    end

    def add_expression_result_escaped(code)
      with_buffer { @src << ' << ' << @escapefunc << '((' << code << '))' }
    end

    def add_expression_block(indicator, code)
      if ((indicator == '=') ^ @escape)
        add_expression_block_result(code)
      else
        add_expression_block_result_escaped(code)
      end
    end

    def add_expression_block_result(code)
      with_buffer { @src << ' << ' << code }
    end

    def add_expression_block_result_escaped(code)
      with_buffer { @src << ' << ' << @escapefunc << '(' << code << ')' }
    end

    def add_postamble(postamble)
      terminate_expression
      @src << postamble
    end

    def with_buffer
      if @chain_appends
        unless @buffer_on_stack
          @src << '; ' << @bufvar
        end
        yield
        @buffer_on_stack = true
      else
        @src << ' ' << @bufvar
        yield
        @src << ';'
      end
    end

    def terminate_expression
      @src << '; ' if @chain_appends && @buffer_on_stack
    end

    ESCAPE_TABLE = {
      "&" => "&amp;",
      "<" => "&lt;",
      ">" => "&gt;",
      '"' => "&quot;",
      "'" => "&#39;",
    }.freeze

    def self.h(value)
      value.to_s.gsub(/[&<>"']/, ESCAPE_TABLE)
    end

    def self.attr(value)
      value.to_s
        .gsub('&', '&amp;')
        .gsub('"', '&quot;')
        .gsub("'", '&#39;')
        .gsub('<', '&lt;')
        .gsub('>', '&gt;')
        .gsub("\n", '&#10;')
        .gsub("\r", '&#13;')
        .gsub("\t", '&#9;')
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
          "\\x#{char.ord.to_s(16).rjust(2, '0')}"
        end
      end
    end

    def self.css(value)
      value.to_s.gsub(/[^\w\-]/) do |char|
        "\\#{char.ord.to_s(16).rjust(6, '0')}"
      end
    end
  end
end
