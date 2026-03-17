# frozen_string_literal: true

require "did_you_mean"

module Herb
  module AST
    class ERBRenderNode < Node
      PARTIAL_EXTENSIONS = Herb::PARTIAL_EXTENSIONS

      def static_partial?
        partial && !partial.value.empty?
      end

      def dynamic?
        !static_partial? && (object || renderable)
      end

      def partial_path
        partial&.value
      end

      def template_name
        template_path&.value
      end

      def layout_name
        layout&.value
      end

      def local_names
        locals.map { |local| local.name&.value }.compact
      end

      def resolve(view_root: nil, source_directory: nil)
        name = partial_path || template_name

        return nil unless name

        view_root = Pathname.new(view_root) unless view_root.nil? || view_root.is_a?(Pathname)

        candidates = candidate_paths(name, view_root, source_directory)
        candidates.find(&:exist?)
      end

      def candidate_paths(name = nil, view_root = nil, source_directory = nil)
        name ||= partial_path || template_name

        return [] unless name

        view_root = Pathname.new(view_root) unless view_root.nil? || view_root.is_a?(Pathname)

        directory = File.dirname(name) if name.include?("/")
        base = name.include?("/") ? File.basename(name) : name
        source_directory = Pathname.new(source_directory) if source_directory && !source_directory.is_a?(Pathname)

        PARTIAL_EXTENSIONS.flat_map do |extension|
          paths = []

          if directory
            paths << view_root.join(directory, "_#{base}#{extension}") if view_root
          else
            paths << source_directory.join("_#{base}#{extension}") if source_directory
            paths << view_root.join("_#{base}#{extension}") if view_root
          end

          paths
        end
      end

      def similar_partials(view_root: nil, source_directory: nil, limit: 3)
        name = partial_path || template_name

        return [] unless name

        suggestions = []

        if view_root
          view_root = Pathname.new(view_root) unless view_root.is_a?(Pathname)

          if view_root.directory?
            all_partials = Dir[File.join(view_root, "**", Herb::PARTIAL_GLOB_PATTERN)].map do |file|
              relative = Pathname.new(file).relative_path_from(view_root).to_s
              relative.sub(%r{(^|/)_}, '\1').sub(/\..*\z/, "")
            end

            spell_checker = DidYouMean::SpellChecker.new(dictionary: all_partials)
            suggestions = spell_checker.correct(name).first(limit)
          end
        elsif source_directory
          source_directory = Pathname.new(source_directory) unless source_directory.is_a?(Pathname)

          if source_directory.directory?
            local_partials = Dir[File.join(source_directory, Herb::PARTIAL_GLOB_PATTERN)].map do |file|
              File.basename(file).sub(/\A_/, "").sub(/\..*\z/, "")
            end

            unless local_partials.empty?
              spell_checker = DidYouMean::SpellChecker.new(dictionary: local_partials)
              suggestions = spell_checker.correct(name).first(limit)
            end
          end
        end

        if suggestions.empty?
          suggestions.concat(find_non_partial_matches(name, view_root, source_directory))
        end

        suggestions
      end

      def find_non_partial_matches(name = nil, view_root = nil, source_directory = nil)
        name ||= partial_path || template_name

        return [] unless name

        matches = []

        PARTIAL_EXTENSIONS.each do |extension|
          if name.include?("/")
            next unless view_root

            view_root = Pathname.new(view_root) unless view_root.is_a?(Pathname)
            directory = File.dirname(name)
            base = File.basename(name)
            non_partial_path = view_root.join(directory, "#{base}#{extension}")

            if non_partial_path.exist?
              matches << "#{name}#{extension} exists as a template, not a partial. Rename to _#{base}#{extension} to use it with render"
            end
          else
            if source_directory
              source_directory = Pathname.new(source_directory) unless source_directory.is_a?(Pathname)
              non_partial_path = source_directory.join("#{name}#{extension}")

              if non_partial_path.exist?
                matches << "#{name}#{extension} exists as a template, not a partial. Rename to _#{name}#{extension} to use it with render"
              end
            end

            if view_root
              view_root = Pathname.new(view_root) unless view_root.is_a?(Pathname)
              non_partial_path = view_root.join("#{name}#{extension}")

              if non_partial_path.exist?
                matches << "#{name}#{extension} exists as a template, not a partial. Rename to _#{name}#{extension} to use it with render"
              end
            end
          end
        end

        matches.uniq
      end
    end
  end
end
