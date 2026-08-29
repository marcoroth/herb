# frozen_string_literal: true
# typed: true

require_relative "../../visitor"
require_relative "../../visitor/experimental"
require_relative "../../visitor/context_aware"
require_relative "../../action_view/helper_registry"

module Herb
  class Engine
    # Asks the parser to resolve Action View helpers into the markup they produce, so the compiler
    # emits that markup directly instead of a call the renderer has to make.
    #
    # It rewrites nothing itself. The work happens in the parser, and this says the template wants
    # it done:
    #
    #     Herb::Engine.new(source, visitors: [Herb::Engine::OptimizeVisitor.new])
    #
    # Inserting it is the whole opt-in. There is no check first for whether a template looks like
    # it contains helpers, because a caller that added this has already answered that question.
    #
    # Its presence also lets the engine collapse a template that carries no Ruby into the single
    # string literal it renders, skipping the buffer the compiler would otherwise build up. A
    # template that was HTML to begin with qualifies, and so does one left fully static once the
    # helpers above resolved to markup. The collapse is held back when the caller drives the buffer
    # itself through `preamble`, `postamble`, `bufval`, or `ensure`, and when a visitor recorded a
    # diagnostic that the compiled template still needs to report.
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
      end

      #: () -> Hash[Symbol, untyped]
      def required_parser_options
        return super unless @verify

        super.merge(track_locations: true)
      end

      #: (Herb::AST::DocumentNode) -> void
      def visit_document_node(node)
        @sources = {} #: Hash[String, Herb::Location?]

        super

        return unless @verify
        return if @sources.empty?

        node.children << check_node(node)
      end

      #: (Herb::AST::HTMLElementNode) -> void
      def visit_html_element_node(node)
        collect(node.element_source, node.location)

        super
      end

      #: (Herb::AST::HTMLConditionalElementNode) -> void
      def visit_html_conditional_element_node(node)
        collect(node.element_source, node.location)

        super
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
