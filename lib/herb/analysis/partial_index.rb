# frozen_string_literal: true

require "pathname"

require_relative "partial_declaration"
require_relative "partial_resolution"

module Herb
  module Analysis
    class PartialIndex
      APPLICATION_DIRECTORY = "application" #: String

      attr_reader :view_root #: Pathname

      attr_reader :templates #: Array[String]

      #: (String | Pathname, ?templates: Array[String]?) -> PartialIndex
      def self.build(project_path, templates: nil)
        root = Pathname.new(project_path)
        view_root = resolve_view_root(root)
        files = templates || Dir[view_root.join("**", PartialResolution::TEMPLATE_GLOB_PATTERN)].sort

        new(view_root, files)
      end

      #: (String | Pathname) -> Pathname
      def self.resolve_view_root(project_path)
        PartialResolution.view_root_for(project_path)
      end

      #: (String | Pathname | Array[String | Pathname], Array[String]) -> void
      def initialize(view_root, templates)
        roots = view_root.is_a?(Array) ? view_root : [view_root]

        @view_roots = roots.map { |root| Pathname.new(root) } #: Array[Pathname]
        @view_root = @view_roots.first || Pathname.new(".")
        @templates = templates
        @by_name = build_index(templates)
        @declarations = {} #: Hash[String, PartialDeclaration?]
      end

      #: () -> Array[Pathname]
      attr_reader :view_roots

      #: (String?) -> Array[String]
      def files_for(partial_name)
        return [] unless partial_name

        @by_name[partial_name] || []
      end

      #: (String?, String?) -> Array[String]
      def resolve(partial_name, source_file)
        return [] unless partial_name

        exact = files_for(partial_name)

        return exact if exact.any?

        if source_file
          relative = source_directory_for(source_file)

          if relative && relative != "."
            sibling = files_for("#{relative}/#{partial_name}")

            return sibling if sibling.any?
          end
        end

        return [] if partial_name.include?("/")

        files_for("#{APPLICATION_DIRECTORY}/#{partial_name}")
      end

      #: (String, String | Pathname) -> String?
      def self.partial_name_for(file, view_root)
        PartialResolution.partial_name_for(file, view_root)
      end

      #: (String) -> String?
      def partial_name_for(file)
        PartialResolution.partial_name_for_roots(file, @view_roots)
      end

      #: () -> Array[String]
      def names
        @by_name.keys
      end

      #: (String?, String?) -> PartialDeclaration?
      def lookup(partial_name, source_file)
        file = resolve(partial_name, source_file).first

        return nil unless file

        declaration_for_file(file)
      end

      #: (String) -> PartialDeclaration?
      def declaration_for_file(file)
        @declarations[file] ||= build_declaration(file)
      end

      #: (String) -> String?
      def update(file)
        name = partial_name_for(file)

        return nil unless name

        @declarations.delete(file)
        @templates = (@templates | [file]).sort

        files = (@by_name[name] || []) | [file]
        ordered = PartialResolution.by_precedence(files)

        @by_name[name] = ordered.sort_by { |candidate| PartialResolution.root_index_for(candidate, @view_roots) }

        name
      end

      #: (String) -> String?
      def remove(file)
        name = partial_name_for(file)

        return nil unless name

        @declarations.delete(file)
        @templates = @templates - [file]

        files = (@by_name[name] || []) - [file]

        if files.empty?
          @by_name.delete(name)
        else
          @by_name[name] = files
        end

        name
      end

      #: () -> Integer
      def size
        @by_name.size
      end

      #: () -> Hash[String, untyped]
      def to_h
        partials = {} #: Hash[String, untyped]

        names.sort.each do |name|
          declaration = lookup(name, nil)

          partials[name] = declaration.to_h if declaration
        end

        { "viewRoot" => @view_root.to_s, "partials" => partials }
      end

      private

      #: (String) -> String?
      def source_directory_for(source_file)
        directory = Pathname.new(File.dirname(source_file))
        root = @view_roots.find { |candidate| directory.to_s.start_with?(candidate.to_s) } || @view_root

        directory.relative_path_from(root).to_s
      rescue ArgumentError
        nil
      end

      #: (String) -> PartialDeclaration?
      def build_declaration(file)
        return nil unless File.exist?(file)

        source = File.read(file)
        document = ::Herb.parse(source, strict_locals: true).value

        PartialDeclaration.from_document(document, file)
      rescue StandardError
        PartialDeclaration.without_strict_locals(file)
      end

      #: (Array[String]) -> Hash[String, Array[String]]
      def build_index(files)
        map = {} #: Hash[String, Array[String]]

        files.each do |file|
          name = partial_name_for(file)

          next unless name

          (map[name] ||= []) << file
        end

        map.each_value do |candidates|
          ordered = PartialResolution.by_precedence(candidates)
          candidates.replace(ordered.sort_by { |file| PartialResolution.root_index_for(file, @view_roots) })
        end

        map
      end
    end
  end
end
