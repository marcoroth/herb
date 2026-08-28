# frozen_string_literal: true
# typed: false

require "json"
require "time"
require "pathname"

require_relative "engine/visitor_context"
require_relative "engine/visitor_stack"
require_relative "engine/report/session"
require_relative "engine/context_aware"
require_relative "engine/diagnostics"
require_relative "engine/compiler"
require_relative "engine/error_formatter"
require_relative "engine/errors"
require_relative "engine/parse_error"

module Herb
  class Engine
    VISITOR_DESCRIPTION_LIMIT = 200 #: Integer

    attr_reader :src, :context, :bufvar, :visitors

    #: () -> Pathname?
    def filename
      @context.file_path
    end

    #: () -> Pathname
    def project_path
      @context.project_path
    end

    #: () -> String
    def relative_file_path
      @context.relative_file_path
    end

    #: (String) -> String
    def string_literal(text)
      "'#{text.gsub(/['\\]/, '\\\\\&')}#{@text_end}"
    end

    ESCAPE_TABLE = {
      "&" => "&amp;",
      "<" => "&lt;",
      ">" => "&gt;",
      '"' => "&quot;",
      "'" => "&#39;",
    }.freeze

    ATTRIBUTE_ESCAPE_TABLE = ESCAPE_TABLE.merge(
      "\n" => "&#10;",
      "\r" => "&#13;",
      "\t" => "&#9;"
    ).freeze

    def initialize(input, properties = {})
      @context = VisitorContext.new(
        file_path: properties[:filename],
        project_path: properties[:project_path],
        options: context_options(properties),
        **(properties[:context] || {})
      )

      @bufvar = properties[:bufvar] || properties[:outvar] || "_buf"
      @escape = properties.fetch(:escape) { properties.fetch(:escape_html, false) }
      @escapefunc = properties.fetch(:escapefunc, @escape ? "__herb.h" : "::Herb::Engine.h")
      @attrfunc = properties.fetch(:attrfunc, @escape ? "__herb.attr" : "::Herb::Engine.attr")
      @jsfunc = properties.fetch(:jsfunc, @escape ? "__herb.js" : "::Herb::Engine.js")
      @cssfunc = properties.fetch(:cssfunc, @escape ? "__herb.css" : "::Herb::Engine.css")
      @src = properties[:src] || String.new
      @chain_appends = properties[:chain_appends]
      @buffer_on_stack = false
      @parser_options = properties.fetch(:parser_options, default_parser_options).transform_keys(&:to_sym)

      @visitors = VisitorStack.build(properties.fetch(:visitors, VisitorStack.new))
      @visitors.validate_order!
      @parser_options = Herb::Visitor.parser_options_for(@visitors, @parser_options)

      @freeze = properties[:freeze]
      @freeze_template_literals = properties.fetch(:freeze_template_literals, true)
      @text_end = @freeze_template_literals ? "'.freeze" : "'"

      bufval = properties[:bufval] || "::String.new"
      preamble = properties[:preamble] || "#{@bufvar} = #{bufval};"
      postamble = properties[:postamble] || "#{@bufvar}.to_s\n"
      preamble = "#{preamble}; " unless preamble.empty? || preamble.end_with?(";", " ", "\n")

      @src << "# frozen_string_literal: true\n" if @freeze

      parse_result = ::Herb.parse(input, **parse_options, track_whitespace: true)
      parser_errors = parse_result.errors

      if parser_errors.any?
        handle_parser_errors(parser_errors, input, parse_result.value)
      else
        @visitors.each do |visitor|
          visitor.inherit_context(@context) if visitor.is_a?(ContextAware)
          visitor.bufvar = @bufvar if visitor.respond_to?(:bufvar=)

          parse_result.value.accept(visitor)
        end

        # A visitor that writes into the tree writes after every visitor has read it, so what one
        # of them adds is never something another one reads as if the template had written it.
        @visitors.each do |visitor| # rubocop:disable Style/CombinableLoops
          visitor.finish(parse_result.value) if visitor.respond_to?(:finish)
        end

        wrapping = wrap_postamble(postamble)
        wrapped = !wrapping.equal?(postamble)
        postamble = wrapping

        compiler = compiler_class.new(self, properties)

        parse_result.value.accept(compiler)

        static_body = buffer_required?(properties) || wrapped ? nil : compile_static_body(compiler)

        if static_body
          @src << static_body
        else
          write_buffer_prelude(properties, preamble)

          report(input)

          compiler.generate_output

          @src << "\n" unless @src.end_with?("\n")
          add_postamble(postamble)

          @src << "; ensure\n  #{@bufvar} = __original_outvar\nend\n" if properties[:ensure]

          insert_herb_alias!
        end
      end

      if properties.fetch(:validate_ruby, false)
        ensure_valid_ruby!(@src)
      end

      @src.freeze
      freeze
    end

    def self.h(value)
      value.to_s.gsub(/[&<>"']/, ESCAPE_TABLE)
    end

    #: (untyped) -> String
    def self.raw(value)
      string = value.to_s

      string.respond_to?(:html_safe) ? string.html_safe : string
    end

    def self.attr(value)
      value.to_s.gsub(/[&<>"'\n\r\t]/, ATTRIBUTE_ESCAPE_TABLE)
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

    def self.nested_attribute_value(value)
      value.is_a?(::String) || value.is_a?(::Symbol) ? value.to_s : value.to_json
    end

    def self.comment?(code)
      code.include?("#")
    end

    def self.heredoc?(code)
      code.match?(/<<[~-]?\s*['"`]?\w/)
    end

    protected

    #: () -> untyped
    def compiler_class
      Compiler
    end

    def add_text(text)
      return if text.empty?

      text = text.gsub(/['\\]/, '\\\\\&')

      with_buffer { @src << " << '" << text << @text_end }
    end

    def add_code(code)
      terminate_expression

      if code.include?("=begin") || code.include?("=end")
        @src << "\n" << code << "\n"
      else
        @src.chomp! if @src.end_with?("\n") && code.start_with?(" ") && !code.end_with?("\n")

        @src << " " << code

        # TODO: rework and check for Prism::InlineComment as soon as we expose the Prism Nodes in the Herb AST
        if self.class.comment?(code) || self.class.heredoc?(code)
          @src << "\n" unless code[-1] == "\n"
        else
          @src << ";" unless code[-1] == "\n"
        end
      end

      @buffer_on_stack = false
    end

    def expression_block?
      @_in_expression_block || false
    end

    def add_expression(indicator, code)
      unescaped = (indicator == "=") ^ @escape

      if expression_block?
        unescaped ? add_expression_block_result(code) : add_expression_block_result_escaped(code)
      else
        unescaped ? add_expression_result(code) : add_expression_result_escaped(code)
      end
    end

    def add_context_aware_expression(indicator, code, context)
      escapefunc = context_escape_function(context)

      if escapefunc.nil?
        add_expression(indicator, code)
      else
        with_buffer { @src << " << #{escapefunc}((" << code << trailing_newline(code) << "))" }
      end
    end

    def context_escape_function(context)
      case context
      when :attribute_value then @attrfunc
      when :script_content then @jsfunc
      when :style_content then @cssfunc
      end
    end

    def add_expression_result(code)
      with_buffer {
        @src << " << (" << code << trailing_newline(code) << ").to_s"
      }
    end

    def add_expression_result_escaped(code)
      with_buffer {
        @src << " << " << @escapefunc << "((" << code << trailing_newline(code) << "))"
      }
    end

    def add_expression_block(indicator, code)
      @_in_expression_block = true
      @_expression_block_open_paren = false

      add_expression(indicator, code)
    ensure
      @_in_expression_block = false
    end

    def add_expression_block_result(code)
      @_expression_block_open_paren = true

      with_buffer {
        @src << " << (" << code << trailing_newline(code)
      }
    end

    def add_expression_block_result_escaped(code)
      @_expression_block_open_paren = true

      with_buffer {
        @src << " << " << @escapefunc << "((" << code << trailing_newline(code)
      }
    end

    def add_expression_block_end(code, escaped: false)
      if @_expression_block_open_paren
        terminate_expression

        trailing_newline = code.end_with?("\n")
        code_stripped = code.chomp

        @src.chomp! if @src.end_with?("\n") && code_stripped.start_with?(" ")

        @src << " " << code_stripped
        @src << "\n" if self.class.comment?(code_stripped)
        @src << (escaped ? "))" : ")")
        @src << (trailing_newline ? "\n" : ";")

        @buffer_on_stack = false
      else
        add_code(code)
      end
    end

    def trailing_newline(code)
      return "\n" if self.class.comment?(code)
      return "\n" if self.class.heredoc?(code)

      ""
    end

    def add_postamble(postamble)
      terminate_expression
      @src << postamble
    end

    def with_buffer(&)
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

    #: (Hash[Symbol, untyped]) -> bool
    def buffer_required?(properties)
      return true if properties[:ensure] || properties[:preamble] || properties[:postamble] || properties[:bufval]

      collected_diagnostics.any?
    end

    #: (String) -> String
    def wrap_postamble(postamble)
      @visitors.reduce(postamble) do |carried, visitor|
        visitor.respond_to?(:postamble) ? visitor.postamble(carried) : carried
      end
    end

    #: (untyped) -> String?
    def compile_static_body(compiler)
      @visitors.each do |visitor|
        next unless visitor.respond_to?(:compile_static_body)

        body = visitor.compile_static_body(self, compiler)

        return body if body
      end

      nil
    end

    #: () -> Array[Herb::Diagnostic]
    def collected_diagnostics
      @visitors.grep(Diagnostics).flat_map(&:diagnostics)
    end

    #: (Hash[Symbol, untyped], String) -> void
    def write_buffer_prelude(properties, preamble)
      if properties[:ensure]
        @src << "begin; __original_outvar = #{@bufvar}"
        @src << (/\A@[^@]/ =~ @bufvar ? "; " : " if defined?(#{@bufvar}); ")
      end

      @herb_alias_index = (@src.length if @escape && @escapefunc == "__herb.h")
      @src << preamble
    end

    #: () -> void
    def insert_herb_alias!
      return unless @herb_alias_index
      return unless @src.include?("__herb.")

      @src.insert(@herb_alias_index, "__herb = ::Herb::Engine; ")
    end

    def handle_parser_errors(parser_errors, input, _ast)
      formatter = ErrorFormatter.new(input, parser_errors, filename: filename)

      raise ParseError.new(
        formatter.summary,
        details: formatter,
        diagnostics: parser_errors.map { |error|
          error.to_diagnostic(template: relative_file_path)
        },
        source: input,
        filename: relative_file_path,
        visitors: visitor_descriptions,
        parser_options: @parser_options
      )
    end

    #: () -> Array[String]
    def visitor_descriptions
      @visitors.map { |visitor|
        described = visitor.inspect

        described.length > VISITOR_DESCRIPTION_LIMIT ? "#{described[0, VISITOR_DESCRIPTION_LIMIT]}…" : described
      }
    end

    #: (String) -> void
    def report(input)
      reporters = @visitors.grep(Diagnostics)
      diagnostics = reporters.flat_map(&:diagnostics)

      return if diagnostics.empty?

      emit_compile_diagnostics(diagnostics)

      fatal = reporters.select { |reporter| reporter.respond_to?(:fatal?) && reporter.fatal? }

      raise_for(fatal.flat_map(&:errors), input)
    end

    #: (Array[Herb::Diagnostic]) -> void
    def emit_compile_diagnostics(diagnostics)
      entries = diagnostics.map(&:to_ruby).join(", ")

      @src << " ::Herb::Engine::Report::Session.record_compile_diagnostics(#{relative_file_path.inspect}, [#{entries}].freeze);"
    end

    #: (Array[Herb::Diagnostic], String) -> void
    def raise_for(errors, input)
      return if errors.empty?

      declared = errors.find(&:error_class)
      error_class = declared&.error_class

      if declared && error_class
        raise error_class.new(
          declared.message,
          line: declared.location&.start&.line,
          column: declared.location&.start&.column,
          filename: filename,
          suggestion: declared.suggestion
        )
      end

      formatter = ErrorFormatter.new(input, errors, filename: filename)

      raise CompilationError.new(formatter.summary, details: formatter, diagnostics: errors)
    end

    def context_options(properties)
      properties.except(:visitors, :src, :context)
    end

    #: () -> Hash[Symbol, untyped]
    def parse_options
      return @parser_options if @parser_options.key?(:track_locations)

      @parser_options.merge(track_locations: false)
    end

    #: () -> Hash[Symbol, untyped]
    def default_parser_options
      fallback = {} #: Hash[Symbol, untyped]

      Herb.configuration.engine_option("parser_options", fallback)
    end

    def ensure_valid_ruby!(source)
      RubyVM::InstructionSequence.compile(source)
    rescue SyntaxError => e
      return if e.message.include?("Invalid yield")

      begin
        require "prism"
      rescue LoadError
        # Prism not available, fall through
      end

      raise InvalidRubyError.new("Compiled template produced invalid Ruby:\n  - #{e.message}", compiled_source: @src) unless defined?(Prism)

      prism_result = Prism.parse(@src)
      syntax_errors = prism_result.errors.reject { |error| error.type == :invalid_yield }

      if syntax_errors.any?
        details = syntax_errors.map { |error| "  - #{error.message} (line #{error.location.start_line})" }.join("\n")
        raise InvalidRubyError.new("Compiled template produced invalid Ruby:\n#{details}", compiled_source: @src)
      end
    end
  end
end
