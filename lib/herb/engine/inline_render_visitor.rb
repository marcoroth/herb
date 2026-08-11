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
    # A partial is inlined only when the file it names is knowable and the copy would mean what the
    # original did. Some of what a partial means is answered by where it is rather than by what it
    # says, and none of that survives being copied, so `Inliner` reads the partial and leaves it
    # alone when it finds any of it. Anything left alone stays the `render` call it was written as.
    class InlineRenderVisitor < Herb::Visitor
      include ContextAware

      ARRAY_PROPERTIES = [:children, :body, :statements].freeze #: Array[Symbol]
      NODE_PROPERTIES = [:subsequent, :else_clause, :rescue_clause, :ensure_clause].freeze #: Array[Symbol]

      ASSIGNMENT_NODES = [
        :LocalVariableWriteNode,
        :LocalVariableOperatorWriteNode,
        :LocalVariableOrWriteNode,
        :LocalVariableAndWriteNode
      ].freeze #: Array[Symbol]

      recommended_parser_option render_nodes: true

      #: () -> bool
      def self.inlines_renders?
        true
      end

      #: (Herb::AST::DocumentNode) -> void
      def visit_document_node(node)
        @inlining = [] #: Array[String]
        @inliner = nil
        @assigned = assigned_locals(node)

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
        node.is_a?(Herb::AST::ERBRenderNode) && outputs?(node) && inliner.can_inline?(node, shadowed: shadowed(node))
      end

      #: (Herb::AST::Node) -> Array[String]
      def shadowed(node)
        @assigned - inliner.local_assignments(node).keys
      end

      #: (Herb::AST::Node, ?Array[String]) -> Array[String]
      def assigned_locals(node, names = [])
        assigned = assigned_name(node)

        names << assigned if assigned

        ARRAY_PROPERTIES.each do |property|
          next unless node.respond_to?(property) && node.send(property).is_a?(Array)

          node.send(property).each { |child| assigned_locals(child, names) if child.is_a?(Herb::AST::Node) }
        end

        NODE_PROPERTIES.each do |property|
          next unless node.respond_to?(property) && node.send(property).is_a?(Herb::AST::Node)

          assigned_locals(node.send(property), names)
        end

        names
      end

      #: (Herb::AST::Node) -> String?
      def assigned_name(node)
        return nil unless node.respond_to?(:parsed_prism_node)

        prism = node.send(:parsed_prism_node)

        return nil unless prism
        return nil unless ASSIGNMENT_NODES.include?(prism.class.name.to_s.split("::").last&.to_sym)

        prism.name.to_s
      end

      #: (Herb::AST::Node) -> bool
      def outputs?(node)
        node.send(:tag_opening)&.value.to_s.include?("=")
      end

      #: (Herb::AST::Node) -> Array[Herb::AST::Node]
      def spliced(node)
        path = inliner.resolve_path(node)

        return [node] unless path
        return [node] if @inlining.include?(path.to_s)

        source = File.read(path)
        partial = parse(source)

        return [node] unless partial

        @inlining.push(path.to_s)

        body = partial.children

        inline_nested(body)

        @inlining.pop

        [block(node, body, path, inliner.own_locals(source))]
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

      #: (String) -> Herb::AST::DocumentNode?
      def parse(source)
        configured = context.options[:parser_options] || {} #: Hash[Symbol, untyped]
        options = Herb::Visitor.parser_options_for([self], configured)

        result = ::Herb.parse(source, **options, track_whitespace: true)

        return nil if result.errors.any?

        result.value
      end

      #: (Herb::AST::Node, Array[String]) -> String
      def opening_for(node, own)
        locals = inliner.local_assignments(node)

        return "->(#{locals.keys.join(", ")}#{block_locals(own, locals.keys)}) {" unless inliner.collection?(node)

        item = inliner.collection_item_name(node)
        taken = [item, "#{item}_counter"]
        assigned = locals.map { |name, value| "#{name} = (#{value});" }.join(" ")

        "((#{inliner.collection_expression(node)}) || []).each_with_index " \
          "do |#{item}, #{item}_counter#{block_locals(own + locals.keys, taken)}| #{assigned}"
      end

      #: (Array[String], Array[String]) -> String
      def block_locals(names, taken)
        scoped = names.uniq - taken

        return "" if scoped.empty?

        "; #{scoped.join(", ")}"
      end

      #: (Herb::AST::Node) -> String
      def closing_for_code(node)
        return "end" if inliner.collection?(node)

        "}.call(#{inliner.local_assignments(node).values.map { |value| "(#{value})" }.join(", ")})"
      end

      #: (Herb::AST::Node, Array[Herb::AST::Node], Pathname, Array[String]) -> Herb::AST::ERBBlockNode
      def block(node, body, path, own)
        Herb::AST::ERBBlockNode.build(
          tag_opening: Herb::Token.from("TOKEN_ERB_START", "<%"),
          content: Herb::Token.from("TOKEN_ERB_CONTENT", " #{opening_for(node, own)} "),
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
          content: Herb::Token.from("TOKEN_ERB_CONTENT", " #{closing_for_code(node)} "),
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
