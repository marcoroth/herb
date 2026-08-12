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

      #: (String, String | Pathname) -> String?
      def partial_name_for(file, view_root)
        return nil unless partial_path?(file)

        root = view_root.is_a?(Pathname) ? view_root : Pathname.new(view_root)
        relative = Pathname.new(file).relative_path_from(root).to_s
        directory = File.dirname(relative)
        name = File.basename(relative).delete_prefix(PARTIAL_PREFIX).sub(/\..*\z/, "")

        directory == "." ? name : "#{directory}/#{name}"
      end
    end
  end
end
