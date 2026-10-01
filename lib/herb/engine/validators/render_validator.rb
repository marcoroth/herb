# frozen_string_literal: true

require_relative "base"

module Herb
  class Engine
    module Validators
      class RenderValidator < Base
        def visit_erb_render_node(node)
          if node.dynamic?
            warning(
              "Dynamic render call cannot be statically resolved",
              node.location,
              code: "RenderDynamic"
            )
          elsif node.static_partial?
            validate_partial_exists(node)
          end

          super
        end

        private

        def validate_partial_exists(node)
          return unless filename

          name = node.partial_path.to_s
          resolver = context.resolver

          return if resolver.resolve(name, from: filename)

          message = "Partial '#{node.partial_path}' could not be resolved."
          searched = resolver.candidates(name, from: filename)

          if searched.any?
            relative_paths = searched.map { |path| resolver.identifier_for(path) }.uniq
            message += "\n     Looked in:\n"

            relative_paths.each do |path|
              message += "       - #{path}\n"
            end
          end

          suggestions = resolver.similar(name, from: filename)

          if suggestions.any?
            partial_suggestions, hint_suggestions = suggestions.partition { |suggestion| !suggestion.include?("exists as a template") }

            if partial_suggestions.any?
              message += "     Did you mean: #{partial_suggestions.map { |suggestion| "'#{suggestion}'" }.join(", ")}?\n"
            end

            hint_suggestions.each do |hint|
              message += "\n     Note: #{hint}\n"
            end
          end

          error(
            message,
            node.location,
            code: "RenderUnresolved"
          )
        end

        def filename
          context.file_path
        end
      end
    end
  end
end
