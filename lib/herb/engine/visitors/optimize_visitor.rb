# frozen_string_literal: true
# typed: true

require_relative "../../visitor"
require_relative "../../visitor/experimental"
require_relative "../../visitor/context_aware"
require_relative "../helpers"
require_relative "../../action_view/helper_registry"

module Herb
  class Engine
    # Asks the parser to resolve Action View helpers into the markup they produce, so the compiler
    # emits that markup directly instead of a call the renderer has to make. Passing it is the
    # whole opt-in:
    #
    #     Herb::Engine.new(source, visitors: [Herb::Engine::OptimizeVisitor.new])
    #
    # There is no check first for whether a template looks like it contains helpers, because a
    # caller that added this has already answered that question.
    #
    # An output tag whose Ruby is a single string, integer, or float literal renders the same text
    # every time, so the visitor folds it into the template text around it. `<%= "hello" %>`
    # compiles to the text `hello`, with nothing left to evaluate when the template renders. The
    # escaping the compiler would have arranged at render time is applied once here instead, by the
    # same functions it would have called, so the fold produces byte for byte what the expression
    # would have, in an attribute value and inside `<script>` or `<style>` just as in plain
    # content. A caller that swapped one of those functions out through `escapefunc`, `attrfunc`,
    # `jsfunc`, or `cssfunc` gets the fold only when the stock function leaves the value untouched,
    # on the grounds that an escape function has nothing to do there either.
    #
    # A literal that spans lines, sits in a trimming tag, or renders nothing at all stays dynamic,
    # so folding never moves another tag off the line it was written on and never changes how the
    # whitespace around the tag is handled.
    #
    # Its presence also lets the engine collapse a template that carries no Ruby into the single
    # string literal it renders, skipping the buffer the compiler would otherwise build up. A
    # template that was HTML to begin with qualifies, and so does one left fully static once the
    # helpers above resolved to markup and the literal outputs folded into text. The collapse is
    # held back when the caller drives the buffer itself through `preamble`, `postamble`, `bufval`,
    # or `ensure`, and when a visitor recorded a diagnostic that the compiled template still needs
    # to report.
    #
    # Replacing a helper call with its markup is only the same thing as calling it while the helper
    # is the one it was resolved against. An application that defines its own `content_tag` gets the
    # stock markup instead, everywhere, with nothing at the call site to say so. `verify` compiles a
    # check into the template that runs when it renders and reports a helper that has since been
    # overwritten:
    #
    #     Herb::Engine::OptimizeVisitor.new(verify: true)
    #
    # It costs a call per render and reports rather than corrects, so it earns its place in
    # development and not in production. Compiling it in is the caller's decision for the same reason
    # the optimization itself is.
    #
    class OptimizeVisitor < Herb::Visitor
      extend Herb::Visitor::Experimental
      include Herb::Visitor::ContextAware

      SESSION = "::Herb::Engine::Runtime::Session" #: String
      CODE = "overwritten-helper" #: String
      ORIGIN = "Herb Engine" #: String

      OUTPUT_OPENINGS = ["<%=", "<%=="].freeze #: Array[String]
      CHILD_LISTS = [:children, :body, :statements].freeze #: Array[Symbol]

      required_parser_option action_view_helpers: true, transform_conditionals: true
      experimental "Compile-time optimizations are experimental. Output may differ from standard Action View rendering."

      #: () -> Array[String]
      def self.helper_sources
        @helper_sources ||= Herb::ActionView::HelperRegistry.supported.map(&:source).freeze
      end

      #: (?verify: bool) -> void
      def initialize(verify: false)
        super()

        @verify = verify
        @sources = {} #: Hash[String, Herb::Location?]
        @output_contexts = [] #: Array[Symbol]
      end

      #: () -> Hash[Symbol, untyped]
      def required_parser_options
        return super unless @verify

        super.merge(track_locations: true)
      end

      #: (Herb::AST::DocumentNode) -> void
      def visit_document_node(node)
        @sources = {} #: Hash[String, Herb::Location?]
        @output_contexts = [] #: Array[Symbol]

        super

        return unless @verify
        return if @sources.empty?

        node.children << check_node(node)
      end

      #: (Herb::AST::Node) -> void
      def visit_node(node)
        CHILD_LISTS.each do |name|
          next unless node.respond_to?(name)

          children = node.public_send(name)

          next unless children.is_a?(Array)

          children.map! { |child| folded_literal(child) || child }
        end
      end

      #: (Herb::AST::HTMLElementNode) -> void
      def visit_html_element_node(node)
        collect(node.element_source, node.location)

        with_output_context(element_output_context(node)) { super }
      end

      #: (Herb::AST::HTMLConditionalElementNode) -> void
      def visit_html_conditional_element_node(node)
        collect(node.element_source, node.location)

        with_output_context(element_output_context(node)) { super }
      end

      #: (Herb::AST::HTMLAttributeValueNode) -> void
      def visit_html_attribute_value_node(node)
        with_output_context(:attribute_value) { super }
      end

      #: (Herb::Engine, untyped) -> String?
      def compile_static_body(engine, compiler)
        text = compiler.static_template_text

        return unless text

        engine.string_literal(text)
      end

      #: () -> String
      def inspect
        return "#<#{self.class.name}>" unless @verify

        "#<#{self.class.name} verify=true>"
      end

      private

      #: ((Herb::AST::HTMLElementNode | Herb::AST::HTMLConditionalElementNode)) -> Symbol?
      def element_output_context(node)
        case node.tag_name&.value&.downcase
        when "script" then :script_content
        when "style" then :style_content
        end
      end

      #: (Symbol?) { () -> void } -> void
      def with_output_context(output_context)
        return yield unless output_context

        @output_contexts.push(output_context)

        begin
          yield
        ensure
          @output_contexts.pop
        end
      end

      #: () -> Symbol
      def current_output_context
        @output_contexts.last || :html_content
      end

      #: (Herb::AST::Node?) -> Herb::AST::LiteralNode?
      def folded_literal(node)
        return unless node.is_a?(Herb::AST::ERBContentNode)

        opening = node.tag_opening&.value

        return unless opening
        return unless OUTPUT_OPENINGS.include?(opening)
        return unless node.tag_closing&.value == "%>"

        code = node.content&.value

        return unless code
        return if code.include?("\n")

        value = literal_value(code)

        return unless value

        text = output_text(value, opening)

        return unless text
        return if text.empty? || text.include?("\n")

        Herb::AST::LiteralNode.build(content: +text, location: node.location)
      end

      #: (String) -> String?
      def literal_value(code)
        return unless Helpers.prism_available?

        result = Prism.parse(code)

        return unless result.success?

        statements = result.value.statements.body

        return unless statements.length == 1

        case (statement = statements.first)
        when Prism::StringNode then statement.unescaped
        when Prism::IntegerNode, Prism::FloatNode then statement.value.to_s
        end
      end

      #: (String, String) -> String?
      def output_text(value, opening)
        case current_output_context
        when :attribute_value then escaped_output(value, :attrfunc) { Engine.attr(value) }
        when :script_content then escaped_output(value, :jsfunc) { Engine.js(value) }
        when :style_content then escaped_output(value, :cssfunc) { Engine.css(value) }
        else
          return value unless escape_output?(opening)

          escaped_output(value, :escapefunc) { Engine.h(value) }
        end
      end

      #: (String, Symbol) { () -> String } -> String?
      def escaped_output(value, option)
        escaped = yield

        return escaped unless context.options.key?(option)
        return value if escaped == value

        nil
      end

      #: (String) -> bool
      def escape_output?(opening)
        options = context.options
        escape = options.fetch(:escape) { options.fetch(:escape_html, false) }

        opening == "<%==" ? !escape : !!escape
      end

      #: (String?, Herb::Location?) -> void
      def collect(source, location)
        return unless source
        return unless self.class.helper_sources.include?(source)
        return if @sources.key?(source)

        @sources[source] = location

        nil
      end

      #: (Herb::AST::DocumentNode) -> Herb::AST::ERBContentNode
      def check_node(node)
        checks = @sources.map { |source, location| check_for(source, location) }.join("; ")

        Herb::AST::ERBContentNode.build(
          tag_opening: Herb::Token.from("TOKEN_ERB_START", "<%"),
          content: Herb::Token.from("TOKEN_ERB_CONTENT", " #{checks} "),
          tag_closing: Herb::Token.from("TOKEN_ERB_END", "%>"),
          valid: true,
          location: node.location
        )
      end

      #: (String, Herb::Location?) -> String
      def check_for(source, location)
        expected, _, name = source.rpartition("#")

        "#{SESSION}.record_compile_diagnostics(#{context.relative_file_path.dump}, " \
          "[#{entry_for(name, expected, location)}].freeze) " \
          "if respond_to?(#{name.to_sym.inspect}, true) && method(#{name.to_sym.inspect}).owner.to_s != #{expected.dump}"
      end

      #: (String, String, Herb::Location?) -> String
      def entry_for(name, expected, location)
        message = "`#{name}` was compiled away as #{expected}, but here it is defined by "

        parts = [
          "message: #{message.dump} + method(#{name.to_sym.inspect}).owner.to_s",
          "severity: :warning",
          "code: #{CODE.dump}",
          "origin: #{ORIGIN.dump}",
          "suggestion: #{"Remove the override, or compile this template without `OptimizeVisitor`.".dump}"
        ]

        if location
          parts << "line: #{location.start.line}" << "column: #{location.start.column}"
          parts << "end_line: #{location.end.line}" << "end_column: #{location.end.column}"
        end

        "{ #{parts.join(", ")} }"
      end
    end
  end
end
