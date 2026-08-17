# frozen_string_literal: true

require_relative "../validator"
require_relative "../../analysis/partial_resolution"

module Herb
  class Engine
    module Validators
      class RenderValidator < Validator
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

          source_directory = project_path.join(filename).dirname
          resolved = node.resolve(view_root: view_root, source_directory: source_directory)

          return if resolved

          message = "Partial '#{node.partial_path}' could not be resolved."
          searched = node.candidate_paths(nil, view_root, source_directory)

          if searched.any?
            relative_paths = searched.map { |path| relative_to_project(path) }.uniq
            message += "\n     Looked in:\n"

            relative_paths.each do |path|
              message += "       - #{path}\n"
            end
          end

          suggestions = node.similar_partials(view_root: view_root, source_directory: source_directory)

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

        def view_root
          @view_root ||= Analysis::PartialResolution.view_root_for(project_path)
        end

        def filename
          context.file_path
        end

        def project_path
          context.project_path
        end

        def relative_to_project(path)
          path.relative_path_from(project_path).to_s
        rescue ArgumentError
          path.to_s
        end
      end
    end
  end
end
