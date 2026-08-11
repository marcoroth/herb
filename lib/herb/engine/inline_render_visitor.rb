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

      # Everything here is per-template, including the inliner, which resolves against the directory
      # the template is in. A visitor instance outlives one compile, so anything kept between them
      # would answer the next template with the last one's directory.
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

      # A `<% render %>` that does not output has its value thrown away, so putting the partial's
      # markup where the tag was would add output the template never asked for.
      #: (Herb::AST::Node) -> bool
      def inlinable?(node)
        node.is_a?(Herb::AST::ERBRenderNode) && outputs?(node) && inliner.can_inline?(node, shadowed: shadowed(node))
      end

      # The names the partial would read from the template if it read them at all.
      #
      # A partial only ever sees the locals it was passed, but the copy sits inside the template and
      # a lambda closes over what is around it. So a partial calling a helper the template happens
      # to have a local of the same name for would read the local instead once inlined. The names it
      # was passed are its own and shadow anything outside, so they are not at risk.
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

        partial = parse(File.read(path))

        return [node] unless partial

        @inlining.push(path.to_s)

        body = partial.children

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

      # A partial that does not parse is left as the `render` call it was written as, so that the
      # error is reported against the partial when it is compiled rather than swallowed here. The
      # engine only ever sees the tree it was handed, so a broken partial spliced into it would
      # take its errors out of reach of everything that reports them.
      #: (String) -> Herb::AST::DocumentNode?
      def parse(source)
        configured = context.options[:parser_options] || {} #: Hash[Symbol, untyped]
        options = Herb::Visitor.parser_options_for([self], configured)

        result = ::Herb.parse(source, **options, track_whitespace: true)

        return nil if result.errors.any?

        result.value
      end

      # The partial goes inside something that is a scope, so that the locals it was given are its
      # own. `begin`/`end` is not one, and reads as though it were: locals assigned in the partial
      # went on existing in the template after it, and a name the template had already used was
      # assigned over rather than shadowed.
      #
      # A lambda takes them as parameters, which both scopes them and evaluates them once, where
      # they were written. A collection is a block already, so what it needs instead is its locals
      # declared block-local, or assigning them would reach back out to the template's.
      #: (Herb::AST::Node) -> String
      def opening_for(node)
        locals = inliner.local_assignments(node)

        return "->(#{locals.keys.join(", ")}) {" unless inliner.collection?(node)

        item = inliner.collection_item_name(node)
        scoped = locals.empty? ? "" : "; #{locals.keys.join(", ")}"
        assigned = locals.map { |name, value| "#{name} = (#{value});" }.join(" ")

        "((#{inliner.collection_expression(node)}) || []).each_with_index do |#{item}, #{item}_counter#{scoped}| #{assigned}"
      end

      #: (Herb::AST::Node) -> String
      def closing_for_code(node)
        return "end" if inliner.collection?(node)

        "}.call(#{inliner.local_assignments(node).values.map { |value| "(#{value})" }.join(", ")})"
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
