# frozen_string_literal: true

require_relative "engine/compiler"
require_relative "engine/error_formatter"
require_relative "engine/validator"

module Herb
  class Engine
    class CompilationError < StandardError
    end

    class SecurityError < StandardError
      attr_reader :line, :column, :suggestion

      def initialize(message, line: nil, column: nil, suggestion: nil)
        @line = line
        @column = column
        @suggestion = suggestion
        super(message)
      end
    end

    attr_reader :src, :filename, :bufvar

    def initialize(input, properties = {})
      @input = input
      @filename = properties[:filename]
      @bufvar = properties[:bufvar] || properties[:outvar] || "_buf"
      @bufval = properties[:bufval] || "::String.new"
      @escape = properties.fetch(:escape) { properties.fetch(:escape_html, false) }
      @escapefunc = properties[:escapefunc] || (@escape ? "__herb.h" : "::Herb.h")
      @freeze = properties[:freeze]
      @freeze_template_literals = properties.fetch(:freeze_template_literals, true)
      @preamble = properties[:preamble] || "#{@bufvar} = #{@bufval};"
      @postamble = properties[:postamble] || "#{@bufvar}.to_s\n"

      parse_result = ::Herb.parse(@input)
      ast = parse_result.value
      errors = parse_result.errors

      validator = Validator.new
      ast.accept(validator)
      errors.concat(validator.errors)

      if errors.empty?
        compile!(ast)
      else
        format_and_raise_errors!(errors)
      end

      @src.freeze

      freeze
    end

    private

    def compile!(ast)
      compiler = Compiler.new(
        bufvar: @bufvar,
        escape: @escape,
        escapefunc: @escapefunc,
        freeze_template_literals: @freeze_template_literals,
        preamble: @preamble,
        postamble: @postamble
      )

      @src = String.new

      @src << "# frozen_string_literal: true\n" if @freeze
      @src << "__herb = ::Herb::Engine; " if @escape
      @src << @preamble
      @src << "\n" unless @preamble.end_with?("\n")

      ast.accept(compiler)

      @src << compiler.output
      @src << "\n" unless @src.end_with?("\n")
      @src << @postamble
    end

    def format_and_raise_errors!(errors)
      formatter = ErrorFormatter.new(@input, errors, filename: @filename)
      message = formatter.format_all
      raise CompilationError, "\n#{message}"
    end

    ESCAPE_TABLE = {
      "&" => "&amp;",
      "<" => "&lt;",
      ">" => "&gt;",
      '"' => "&quot;",
      "'" => "&#39;",
    }.freeze

    # HTML content escaping (default)
    def self.h(value)
      value.to_s.gsub(/[&<>"']/, ESCAPE_TABLE)
    end

    # HTML attribute value escaping - more comprehensive for XSS prevention
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

    # JavaScript context escaping
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

    # CSS context escaping
    def self.css(value)
      value.to_s.gsub(/[^\w\-]/) do |char|
        "\\#{char.ord.to_s(16).rjust(6, '0')}"
      end
    end
  end
end
