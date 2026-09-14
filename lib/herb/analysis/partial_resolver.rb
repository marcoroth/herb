# frozen_string_literal: true
# typed: true

require "did_you_mean"
require "pathname"

require_relative "partial_resolution"

module Herb
  module Analysis
    # Finds the file a render call names, and what the compile of that file calls itself.
    #
    # The engine resolves partials at compile time in more than one place, the render
    # validator and the inliner among them, and each used to walk the filesystem on its own
    # from the project's view root. This is the one object they ask instead, and the one an
    # application can replace through `Herb::Engine.new(source, resolver: ...)` with a lookup
    # that knows its real view paths, an engine's or a gem's, and how it names its templates.
    #
    # The default answers from the filesystem the way the engine always has. A name with a
    # directory is looked up under the view root, a bare name next to the calling template
    # and then under the view root, and the identifier is the path relative to the project,
    # which is what the compile of that template reports as its own relative file path.
    #
    class PartialResolver
      Resolved = Data.define(
        :path,      #: Pathname
        :identifier #: String
      )

      TEMPLATE_HINT = "exists as a template, not a partial. Rename to" #: String

      attr_reader :project_path #: Pathname
      attr_reader :view_root #: Pathname?

      #: (?(String | Pathname)?, ?view_root: (String | Pathname | false)?) -> void
      def initialize(project_path = nil, view_root: nil)
        @project_path = Pathname.new(project_path || Dir.pwd)
        @view_root = case view_root
                     when false then nil
                     when nil then PartialResolution.view_root_for(@project_path)
                     else Pathname.new(view_root)
                     end
      end

      #: (String, ?from: (String | Pathname)?, ?format: String?) -> Resolved?
      def resolve(name, from: nil, format: nil)
        paths = candidates(name, from: from)
        paths = prefer_format(paths, format) if format
        path = paths.find(&:exist?)

        return nil unless path

        Resolved.new(path: path, identifier: identifier_for(path))
      end

      #: (String, ?from: (String | Pathname)?) -> Array[Pathname]
      def candidates(name, from: nil)
        candidate_paths(name, source_directory(from))
      end

      #: (String, ?from: (String | Pathname)?, ?limit: Integer) -> Array[String]
      def similar(name, from: nil, limit: 3)
        similar_partials(name, source_directory(from), limit: limit)
      end

      #: (Pathname) -> String
      def identifier_for(path)
        path.relative_path_from(project_path).to_s
      rescue ArgumentError
        path.to_s
      end

      #: (String, Pathname?) -> Array[Pathname]
      def candidate_paths(name, source_directory)
        directories = lookup_directories(name, source_directory)
        base = File.basename(name)

        PartialResolution::EXTENSIONS.flat_map do |extension|
          directories.map { |directory| directory.join("_#{base}#{extension}") }
        end
      end

      #: (String, Pathname?, ?limit: Integer) -> Array[String]
      def similar_partials(name, source_directory, limit: 3)
        names = partial_names(source_directory)
        suggestions = DidYouMean::SpellChecker.new(dictionary: names).correct(name).first(limit)

        suggestions.empty? ? non_partial_matches(name, source_directory) : suggestions
      end

      #: (String, Pathname?) -> Array[String]
      def non_partial_matches(name, source_directory)
        directories = lookup_directories(name, source_directory)
        base = File.basename(name)

        PartialResolution::EXTENSIONS.filter_map do |extension|
          next unless directories.any? { |directory| directory.join("#{base}#{extension}").exist? }

          "#{name}#{extension} #{TEMPLATE_HINT} _#{base}#{extension} to use it with render"
        end
      end

      private

      #: (String, Pathname?) -> Array[Pathname]
      def lookup_directories(name, source_directory)
        root = view_root

        return [source_directory, root].compact unless name.include?("/")

        root ? [root.join(File.dirname(name))] : []
      end

      #: (Pathname?) -> Array[String]
      def partial_names(source_directory)
        root = view_root
        directory = root || source_directory

        return [] unless directory&.directory?

        pattern = root ? File.join(root, "**", PartialResolution::PARTIAL_GLOB_PATTERN) : File.join(directory, PartialResolution::PARTIAL_GLOB_PATTERN)

        Dir[pattern].filter_map { |file| PartialResolution.partial_name_for(file, directory) }.uniq
      end

      #: ((String | Pathname)?) -> Pathname?
      def source_directory(from)
        return nil unless from

        file = Pathname.new(from)
        file = project_path + file unless file.absolute?

        file.dirname
      end

      #: (Array[Pathname], String) -> Array[Pathname]
      def prefer_format(paths, format)
        preferred, rest = paths.partition { |path| path.basename.to_s.include?(".#{format}.") }

        preferred + rest
      end
    end
  end
end
