# frozen_string_literal: true
# typed: false

require_relative "../visitor"
require_relative "context_aware"

module Herb
  class Engine
    # Replaces a `render` of a static partial with the partial itself, so the rendered page costs
    # no partial lookup at run time.
    #
    #     require "herb/engine/inline_render_visitor"
    #
    #     Herb::Engine.new(source, visitors: [Herb::Engine::InlineRenderVisitor.new])
    #
    # It has to run first, and the engine refuses a stack that puts it anywhere else. Everything
    # after it sees the partial's markup as part of the template it landed in, which is what holds
    # a partial to whatever the template around it is held to: a validator that refuses markup in a
    # template refuses it in a partial, and a transform that rewrites a tag rewrites it wherever it
    # was written. Were it to run last, moving markup into a partial would be a way of turning
    # those off.
    #
    # What it moves is recorded on `Herb::Engine::Origin`, because a tree alone cannot say that a
    # node was written somewhere else or that nobody wrote it at all. That is what lets a position
    # reported from inside an inlined partial name the partial rather than the template it landed
    # in, and leaves the wrapper written here attributed to nobody.
    #
    # A partial is inlined only when the file it names is knowable and inlining it changes nothing:
    # a literal path, no block, no `content_for`, no `yield`, no `local_assigns`, and not one
    # already being inlined further up. Anything else is left as the `render` call it was written
    # as.
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

        [block(node, body, path)]
      end

      #: (Pathname) -> String
      def relative(path)
        VisitorContext.derive_relative_file_path(
          Pathname.new(File.expand_path(path.to_s)),
          Pathname.new(File.expand_path(context.project_path))
        )
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

      # The partial goes in as one block rather than as a flat run of nodes, and the block is what
      # carries where its contents came from.
      #
      # Both are the same point: what was moved is the partial, not each node of it. A flat run
      # would be split by anything spliced into the middle of it, which is what a partial rendering
      # a partial is, and each half would then report as a render of its own.
      #: (Herb::AST::Node, Array[Herb::AST::Node], Pathname) -> Herb::AST::ERBBlockNode
      def block(node, body, path)
        Herb::AST::ERBBlockNode.build(
          tag_opening: Herb::Token.from("TOKEN_ERB_START", "<%"),
          content: Herb::Token.from("TOKEN_ERB_CONTENT", " #{opening_for(node)} "),
          tag_closing: Herb::Token.from("TOKEN_ERB_END", "%>"),
          body: body,
          end_node: closing_for(node),
          location: node.location
        ).tap { |block| origin.authored(block, relative(path), from: node) }
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
