# frozen_string_literal: true
# typed: false

require_relative "../visitor"
require_relative "context_aware"

module Herb
  class Engine
    # Asks the compiler to replace a `render` of a static partial with the partial itself, so the
    # rendered page costs no partial lookup at run time.
    #
    # It rewrites nothing on its own. The splice happens in the compiler, which is the only place
    # that can compile one template's tree into the middle of another, and this says the template
    # wants it done:
    #
    #     require "herb/engine/inline_render_visitor"
    #
    #     Herb::Engine.new(source, visitors: [Herb::Engine::InlineRenderVisitor.new])
    #
    # A partial is inlined only when the compiler can be sure which file it means and that inlining
    # it changes nothing: a literal path, no block, no `content_for`, no `yield`, no
    # `local_assigns`, and not one already being inlined further up. Anything else is left as the
    # `render` call it was written as.
    class InlineRenderVisitor < Herb::Visitor
      include ContextAware

      ARRAY_PROPERTIES = [:children, :body, :statements].freeze #: Array[Symbol]
      NODE_PROPERTIES = [:subsequent, :else_clause, :rescue_clause, :ensure_clause].freeze #: Array[Symbol]

      recommended_parser_option render_nodes: true

      #: () -> bool
      def self.inlines_renders?
        true
      end

      #: (Herb::AST::DocumentNode) -> void
      def visit_document_node(node)
        @inlining = [] #: Array[String]

        super

        inline(node)
      end

      #: () -> String
      def inspect
        "#<#{self.class.name}>"
      end

      private

      #: (Herb::AST::Node) -> void
      def inline(node)
        ARRAY_PROPERTIES.each do |property|
          next unless node.respond_to?(property) && node.send(property).is_a?(Array)

          expand(node.send(property))
        end

        NODE_PROPERTIES.each do |property|
          next unless node.respond_to?(property) && node.send(property)

          inline(node.send(property))
        end

        nil
      end

      #: (Array[Herb::AST::Node]) -> void
      def expand(nodes)
        nodes.replace(nodes.flat_map { |child|
          inline(child)

          inlinable?(child) ? spliced(child) : [child]
        })

        nil
      end

      #: (Herb::AST::Node) -> bool
      def inlinable?(node)
        node.is_a?(Herb::AST::ERBRenderNode) && inliner.can_inline?(node)
      end

      #: (Herb::AST::Node) -> Array[Herb::AST::Node]
      def spliced(node)
        path = inliner.resolve_path(node)

        return [node] unless path
        return [node] if @inlining.include?(path.to_s)

        @inlining.push(path.to_s)

        body = parse(File.read(path)).children

        inline_nested(body)

        @inlining.pop

        record(body, node, path)

        [block(node, body)]
      end

      #: (Array[Herb::AST::Node], Herb::AST::Node, Pathname) -> void
      def record(body, node, path)
        file = VisitorContext.derive_relative_file_path(
          Pathname.new(File.expand_path(path.to_s)),
          Pathname.new(File.expand_path(context.project_path))
        )

        body.each { |child| origin.authored(child, file, from: node) }

        nil
      end

      #: (Array[Herb::AST::Node]) -> void
      def inline_nested(body)
        body.each { |child| inline(child) }

        expand(body)

        nil
      end

      #: (String) -> Herb::AST::DocumentNode
      def parse(source)
        configured = context.options[:parser_options] || {} #: Hash[Symbol, untyped]
        options = Herb::Visitor.parser_options_for([self], configured)

        ::Herb.parse(source, **options, track_whitespace: true).value
      end

      #: (Herb::AST::Node) -> String
      def opening_for(node)
        locals = inliner.local_assignments(node).map { |name, value| "#{name} = (#{value});" }

        return "begin; #{locals.join(" ")}" unless inliner.collection?(node)

        item = inliner.collection_item_name(node)

        "begin; (#{inliner.collection_expression(node)}).each_with_index do |#{item}, #{item}_counter|; #{locals.join(" ")}"
      end

      #: (Herb::AST::Node, Array[Herb::AST::Node]) -> Herb::AST::ERBBlockNode
      def block(node, body)
        Herb::AST::ERBBlockNode.build(
          tag_opening: Herb::Token.from("TOKEN_ERB_START", "<%"),
          content: Herb::Token.from("TOKEN_ERB_CONTENT", " #{opening_for(node)} "),
          tag_closing: Herb::Token.from("TOKEN_ERB_END", "%>"),
          body: body,
          end_node: closing_for(node),
          location: node.location
        ).tap { |generated| origin.generated(generated) }
      end

      #: (Herb::AST::Node) -> Herb::AST::ERBEndNode
      def closing_for(node)
        Herb::AST::ERBEndNode.build(
          tag_opening: Herb::Token.from("TOKEN_ERB_START", "<%"),
          content: Herb::Token.from("TOKEN_ERB_CONTENT", inliner.collection?(node) ? " end; end " : " end "),
          tag_closing: Herb::Token.from("TOKEN_ERB_END", "%>"),
          location: node.location
        )
      end

      #: () -> untyped
      def inliner
        @inliner ||= begin
          require_relative "inline_render_visitor/inliner"

          Inliner.new(project_path: context.project_path, filename: context.relative_file_path)
        end
      end
    end
  end
end
