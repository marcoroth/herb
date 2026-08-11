# frozen_string_literal: true

module Herb
  class Engine
    class InlineRenderVisitor
      class Inliner
        VIRTUAL_PATH_DEPENDENT = /\bI18n\.[tl]\b|\b(?:t|l|translate|localize)\(/

        attr_reader :filename

        def initialize(options = {})
          @project_path = options[:project_path] || Pathname.new(Dir.pwd)
          @filename = options[:filename]
          @view_root = find_view_root
          @source_directory = find_source_directory
        end

        def can_inline?(node, shadowed: [])
          return false unless @view_root
          return false unless node.static_partial?
          return false if node.body&.any?

          return can_inline_collection?(node, shadowed: shadowed) if node.keywords&.collection

          resolved = resolve_path(node)

          return false unless resolved

          safe_to_inline?(resolved, shadowed: shadowed)
        end

        def can_inline_collection?(node, shadowed: [])
          return false unless node.static_partial?
          return false if node.keywords&.spacer_template

          resolved = resolve_path(node)

          return false unless resolved

          safe_to_inline?(resolved, item: collection_item_name(node), shadowed: shadowed)
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

        def own_locals(source)
          require "prism"

          ::Prism.parse(::Herb.extract_ruby(source)).value.locals.map(&:to_s)
        rescue StandardError
          []
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

        def safe_to_inline?(file_path, item: nil, shadowed: [])
          source = File.read(file_path)

          # TODO: we might want to revisit these three conditions later
          return false if source.include?("content_for")
          return false if source.match?(/\byield\b/)
          return false if source.include?("local_assigns")
          return false if source.match?(VIRTUAL_PATH_DEPENDENT)
          return false if item && source.include?("#{item}_iteration")

          at_risk = shadowed - own_locals(source)

          return false if at_risk.any? { |name| source.match?(/\b#{Regexp.escape(name)}\b/) }

          true
        end

        def find_view_root
          candidates = [
            @project_path.join("app", "views")
          ]

          candidates.find(&:directory?)
        end

        # The template's own directory, which is where a partial named without one is looked up.
        #
        # `@filename` is already relative to the project and so already carries `app/views`, which
        # is what makes joining it onto the view root wrong: it produces `app/views/app/views/...`,
        # a directory that never exists, and every same-directory render then falls through to the
        # partial of that name at the view root instead.
        def find_source_directory
          return nil unless @filename && @view_root

          @project_path.join(Pathname.new(@filename).dirname)
        end
      end
    end
  end
end
