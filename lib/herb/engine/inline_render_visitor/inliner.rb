# frozen_string_literal: true

module Herb
  class Engine
    class InlineRenderVisitor
      class Inliner
        attr_reader :filename

        def initialize(options = {})
          @project_path = options[:project_path] || Pathname.new(Dir.pwd)
          @filename = options[:filename]
          @view_root = find_view_root
          @source_directory = find_source_directory
        end

        def can_inline?(node)
          return false unless @view_root
          return false unless node.static_partial?
          return false if node.body&.any?

          return can_inline_collection?(node) if node.keywords&.collection

          resolved = resolve_path(node)
          return false unless resolved
          return false unless safe_to_inline?(resolved)

          true
        end

        def can_inline_collection?(node)
          return false unless node.static_partial?
          return false if node.keywords&.spacer_template

          resolved = resolve_path(node)
          return false unless resolved
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

        private

        def safe_to_inline?(file_path)
          source = File.read(file_path)

          # TODO: we might want to revisit these three conditions later
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
    end
  end
end
