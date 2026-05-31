# frozen_string_literal: true

module Herb
  class Engine
    class RenderInliner
      def initialize(engine, options = {})
        @engine = engine
        @project_path = options[:project_path] || Pathname.new(Dir.pwd)
        @filename = options[:filename]
        @view_root = find_view_root
        @source_directory = find_source_directory
        @inlining_stack = Set.new
      end

      def can_inline?(node)
        return false unless @view_root
        return false unless node.static_partial?
        return false if node.body&.any?

        return can_inline_collection?(node) if node.keywords&.collection

        resolved = resolve_path(node)
        return false unless resolved
        return false if @inlining_stack.include?(resolved.to_s)
        return false unless safe_to_inline?(resolved)

        true
      end

      def can_inline_collection?(node)
        return false unless node.static_partial?
        return false if node.keywords&.spacer_template

        resolved = resolve_path(node)
        return false unless resolved
        return false if @inlining_stack.include?(resolved.to_s)
        return false unless safe_to_inline?(resolved)

        true
      end

      def collection?(node)
        !!node.keywords&.collection
      end

      def collection_expression(node)
        node.keywords&.collection&.value
      end

      def collection_item_name(node)
        as_name = node.keywords&.as_name&.value
        return as_name if as_name

        partial = node.partial_path
        return nil unless partial

        File.basename(partial)
      end

      def resolve_path(node)
        node.resolve(view_root: @view_root, source_directory: @source_directory)
      end

      def optimizable_renders(ast)
        collector = OptimizableRenderCollector.new(self)
        ast.accept(collector)
        collector.results
      end

      def local_assignments(node)
        locals = {} #: Hash[String, String]

        node.keywords&.locals&.each do |local|
          name = local.name&.value
          value = local.value&.content

          next unless name && value

          value = name if value == "#{name}:" # Shorthand hash syntax

          locals[name] = value
        end

        locals
      end

      def parse(source)
        result = ::Herb.parse(
          source,
          render_nodes: true,
          track_whitespace: true,
          action_view_helpers: true,
          transform_conditionals: true
        )

        result.value
      end

      def push(path)
        @inlining_stack.add(path.to_s)
      end

      def pop(path)
        @inlining_stack.delete(path.to_s)
      end

      private

      def safe_to_inline?(file_path)
        source = File.read(file_path)

        return false if source.include?("content_for")
        return false if source.match?(/\byield\b/)
        return false if source.include?("local_assigns")

        true
      end

      def find_view_root
        candidates = [
          @project_path.join("app", "views")
        ]

        candidates.find(&:directory?)
      end

      def find_source_directory
        return nil unless @filename && @view_root

        dir = Pathname.new(@filename).dirname
        @view_root.join(dir)
      end
    end

    class OptimizableRenderCollector < ::Herb::Visitor
      attr_reader :results

      def initialize(inliner)
        super()
        @inliner = inliner
        @results = [] #: Array[Hash[Symbol, untyped]]
      end

      def visit_erb_render_node(node)
        if @inliner.can_inline?(node)
          entry = {
            node: node,
            partial_path: node.partial_path,
            resolved_path: @inliner.resolve_path(node),
            locals: @inliner.local_assignments(node),
            collection: @inliner.collection?(node),
          }

          if entry[:collection]
            entry[:collection_expression] = @inliner.collection_expression(node)
            entry[:item_name] = @inliner.collection_item_name(node)
          end

          @results << entry
        end

        visit_child_nodes(node)
      end
    end
  end
end
