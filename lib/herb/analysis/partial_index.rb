# frozen_string_literal: true

require "pathname"

module Herb
  module Analysis
    class PartialIndex
      TEMPLATE_GLOB_PATTERN = "*.{erb,herb}" #: String

      attr_reader :view_root #: Pathname

      attr_reader :templates #: Array[String]

      #: (String | Pathname, ?templates: Array[String]?) -> PartialIndex
      def self.build(project_path, templates: nil)
        root = Pathname.new(project_path)
        view_root = resolve_view_root(root)
        files = templates || Dir[view_root.join("**", TEMPLATE_GLOB_PATTERN)].sort

        new(view_root, files)
      end

      #: (Pathname) -> Pathname
      def self.resolve_view_root(project_path)
        candidates = [
          project_path.join("app", "views"),
          project_path
        ]

        candidates.find(&:directory?) || project_path
      end

      #: (String | Pathname, Array[String]) -> void
      def initialize(view_root, templates)
        @view_root = Pathname.new(view_root)
        @templates = templates
        @by_name = build_index(templates)
      end

      #: (String?) -> Array[String]
      def files_for(partial_name)
        return [] unless partial_name

        @by_name[partial_name] || []
      end

      #: (String, String | Pathname) -> String?
      def self.partial_name_for(file, view_root)
        basename = File.basename(file)

        return nil unless basename.start_with?("_")

        root = view_root.is_a?(Pathname) ? view_root : Pathname.new(view_root)
        relative = Pathname.new(file).relative_path_from(root).to_s
        directory = File.dirname(relative)
        name = basename.sub(/\A_/, "").sub(/\..*\z/, "")

        directory == "." ? name : "#{directory}/#{name}"
      end

      #: (String) -> String?
      def partial_name_for(file)
        self.class.partial_name_for(file, @view_root)
      end

      #: () -> Array[String]
      def names
        @by_name.keys
      end

      private

      #: (Array[String]) -> Hash[String, Array[String]]
      def build_index(files)
        map = {} #: Hash[String, Array[String]]

        files.each do |file|
          name = partial_name_for(file)

          next unless name

          (map[name] ||= []) << file
        end

        map
      end
    end
  end
end
