# frozen_string_literal: true

require "pathname"

module Herb
  module Analysis
    module PartialResolution
      PARTIAL_PREFIX = "_" #: String

      EXTENSIONS = [
        ".html.erb",
        ".html.herb",
        ".erb",
        ".herb",
        ".turbo_stream.erb",
        ".turbo_stream.herb"
      ].freeze #: Array[String]

      EXTENSION_ALTERNATIVES = EXTENSIONS.map { |extension| extension.delete_prefix(".") }.join(",") #: String

      TEMPLATE_GLOB_PATTERN = "*.{#{EXTENSION_ALTERNATIVES}}".freeze #: String
      PARTIAL_GLOB_PATTERN = "#{PARTIAL_PREFIX}#{TEMPLATE_GLOB_PATTERN}".freeze #: String

      VIEW_ROOT = File.join("app", "views") #: String

      LAYOUTS_DIRECTORY = "layouts" #: String
      APPLICATION_LAYOUT = "application" #: String
      MAILER_LAYOUT = "mailer" #: String
      MAILER_SUFFIX = "_mailer" #: String

      class << self
        #: (String | Pathname) -> Pathname
        def view_root_for(project_path)
          root = project_path.is_a?(Pathname) ? project_path : Pathname.new(project_path)

          candidates = [
            root.join(VIEW_ROOT),
            root
          ]

          candidates.find(&:directory?) || root
        end

        #: (String) -> String?
        def format_of(file)
          base = File.basename(file)
          dot = base.index(".")

          return nil unless dot

          extension = base[dot..].to_s
          stripped = extension.delete_suffix(".erb")
          stripped = stripped.delete_suffix(".herb") if stripped == extension

          return nil if stripped == extension

          format = stripped.delete_prefix(".")

          format.empty? ? nil : format
        end

        #: (String) -> String
        def without_template_extension(partial_name)
          extension = EXTENSIONS.find { |candidate| partial_name.end_with?(candidate) }

          extension ? partial_name.delete_suffix(extension) : partial_name
        end

        #: (String) -> bool
        def template_path?(file)
          name = File.basename(file)

          EXTENSIONS.any? { |extension| name.end_with?(extension) }
        end

        #: (String) -> bool
        def partial_path?(file)
          name = File.basename(file)

          return false unless name.start_with?(PARTIAL_PREFIX)

          EXTENSIONS.any? { |extension| name.end_with?(extension) }
        end

        #: (String) -> Integer
        def template_rank(file)
          basename = File.basename(file)
          dot = basename.index(".")

          return EXTENSIONS.size unless dot

          rank = EXTENSIONS.index(basename[dot..])

          rank || EXTENSIONS.size
        end

        #: (String, String) -> bool
        def outranks_template?(candidate, incumbent)
          candidate_rank = template_rank(candidate)
          incumbent_rank = template_rank(incumbent)

          return candidate_rank < incumbent_rank unless candidate_rank == incumbent_rank

          candidate < incumbent
        end

        #: (Array[String]) -> Array[String]
        def by_precedence(files)
          files.sort { |a, b| outranks_template?(a, b) ? -1 : 1 }
        end

        #: (String, String | Pathname) -> String?
        def template_name_for(file, view_root)
          return nil if partial_path?(file)

          relative = relative_to_view_root(file, view_root)

          return nil unless relative

          directory = File.dirname(relative)
          name = File.basename(relative).sub(/\..*\z/, "")

          return nil if name.empty?

          directory == "." ? name : "#{directory}/#{name}"
        end

        #: (String, Array[String | Pathname]) -> Array[String]
        def layout_candidates_for_roots(template_file, view_roots)
          view_roots.lazy.map { |root| layout_candidates_for(template_file, root) }.find { |candidates| candidates.any? } || []
        end

        #: (String, String | Pathname) -> Array[String]
        def layout_candidates_for(template_file, view_root)
          relative = relative_to_view_root(template_file, view_root)

          return [] unless relative
          return [] if File.basename(relative).start_with?(PARTIAL_PREFIX)

          directory = File.dirname(relative)

          return [] if directory == LAYOUTS_DIRECTORY || directory.start_with?("#{LAYOUTS_DIRECTORY}/")
          return ["#{LAYOUTS_DIRECTORY}/#{APPLICATION_LAYOUT}"] if directory == "." || directory == "/"

          segments = directory.split("/")
          mailer = segments.last.end_with?(MAILER_SUFFIX)
          candidates = [] #: Array[String]

          until segments.empty?
            candidates << "#{LAYOUTS_DIRECTORY}/#{segments.join("/")}"
            segments.pop
          end

          candidates << "#{LAYOUTS_DIRECTORY}/#{mailer ? MAILER_LAYOUT : APPLICATION_LAYOUT}"

          candidates
        end

        #: (String, String | Pathname) -> String?
        def partial_name_for(file, view_root)
          return nil unless partial_path?(file)

          relative = relative_to_view_root(file, view_root)

          return nil unless relative

          directory = File.dirname(relative)
          name = File.basename(relative).delete_prefix(PARTIAL_PREFIX).sub(/\..*\z/, "")

          return nil if name.empty?

          directory == "." ? name : "#{directory}/#{name}"
        end

        #: (String, Array[String | Pathname]) -> [Integer, String]?
        def relative_to_view_roots(file, view_roots)
          view_roots.each_with_index do |root, index|
            relative = relative_to_view_root(file, root)

            return [index, relative] if relative
          end

          nil
        end

        #: (String, Array[String | Pathname]) -> String?
        def partial_name_for_roots(file, view_roots)
          view_roots.filter_map { |root| partial_name_for(file, root) }.first
        end

        #: (String, Array[String | Pathname]) -> String?
        def template_name_for_roots(file, view_roots)
          view_roots.filter_map { |root| template_name_for(file, root) }.first
        end

        #: (String, Array[String | Pathname]) -> Integer
        def root_index_for(file, view_roots)
          found = relative_to_view_roots(file, view_roots)

          found ? found[0] : view_roots.size
        end

        private

        #: (String, String | Pathname) -> String?
        def relative_to_view_root(file, view_root)
          root = view_root.is_a?(Pathname) ? view_root : Pathname.new(view_root)
          relative = Pathname.new(file).relative_path_from(root).to_s

          return nil if relative == "." || relative.start_with?("..")

          relative
        rescue ArgumentError
          nil
        end
      end
    end
  end
end
