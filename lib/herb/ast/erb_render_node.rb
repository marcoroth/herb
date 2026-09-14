# frozen_string_literal: true

require "pathname"

require_relative "../analysis/partial_resolver"

module Herb
  module AST
    class ERBRenderNode < Node
      def static_partial?
        keywords&.partial && !keywords&.partial&.value&.empty?
      end

      def dynamic?
        !static_partial? && (keywords&.object || keywords&.renderable)
      end

      def partial_path
        keywords&.partial&.value
      end

      def template_name
        keywords&.template_path&.value
      end

      def layout_name
        keywords&.layout&.value
      end

      def local_names
        keywords&.locals&.map { |local| local.name&.value }&.compact || []
      end

      def resolve(view_root: nil, source_directory: nil)
        name = partial_path || template_name

        return nil unless name

        resolver_for(view_root).candidate_paths(name, coerce_directory(source_directory)).find(&:exist?)
      end

      def candidate_paths(name = nil, view_root = nil, source_directory = nil)
        name ||= partial_path || template_name

        return [] unless name

        resolver_for(view_root).candidate_paths(name, coerce_directory(source_directory))
      end

      def similar_partials(view_root: nil, source_directory: nil, limit: 3)
        name = partial_path || template_name

        return [] unless name

        resolver_for(view_root).similar_partials(name, coerce_directory(source_directory), limit: limit)
      end

      def find_non_partial_matches(name = nil, view_root = nil, source_directory = nil)
        name ||= partial_path || template_name

        return [] unless name

        resolver_for(view_root).non_partial_matches(name, coerce_directory(source_directory))
      end

      private

      def resolver_for(view_root)
        Analysis::PartialResolver.new(view_root: view_root || false)
      end

      def coerce_directory(directory)
        return nil unless directory

        directory.is_a?(Pathname) ? directory : Pathname.new(directory)
      end
    end
  end
end
