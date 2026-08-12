# frozen_string_literal: true

require "pathname"

module Herb
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

    class << self
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
      def partial_name_for(file, view_root)
        return nil unless partial_path?(file)

        relative = relative_to_view_root(file, view_root)

        return nil unless relative

        directory = File.dirname(relative)
        name = File.basename(relative).delete_prefix(PARTIAL_PREFIX).sub(/\..*\z/, "")

        return nil if name.empty?

        directory == "." ? name : "#{directory}/#{name}"
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
