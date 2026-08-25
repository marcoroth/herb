# frozen_string_literal: true

module Herb
  module Analysis
    StrictLocal = Data.define(:name, :required, :default_source)

    class StrictLocal
      #: (name: String, required: bool, ?default_source: String?) -> void
      def initialize(name:, required:, default_source: nil)
        super
      end

      #: () -> Hash[String, untyped]
      def to_h
        serialized = { "name" => name, "required" => required }
        serialized["defaultSource"] = default_source if default_source
        serialized
      end

      #: (Hash[String, untyped]) -> StrictLocal
      def self.from(data)
        new(name: data["name"], required: data["required"], default_source: data["defaultSource"])
      end
    end

    class PartialDeclaration
      KEYWORD_KIND = "keyword" #: String
      KEYWORD_REST_KIND = "keyword_rest" #: String

      attr_reader :file #: String
      attr_reader :locals #: Array[StrictLocal]
      attr_reader :location #: Hash[String, Integer]?

      attr_accessor :has_declaration #: bool
      attr_accessor :has_keyword_rest #: bool

      #: (String) -> PartialDeclaration
      def self.without_strict_locals(file)
        new(file)
      end

      #: (Herb::AST::DocumentNode, String) -> PartialDeclaration
      def self.from_document(document, file)
        declaration = without_strict_locals(file)

        document.children.each do |child|
          next unless child.is_a?(AST::ERBStrictLocalsNode)

          declaration.has_declaration = true
          declaration.location ||= location_of(child)

          child.locals&.each do |local|
            next unless local.is_a?(AST::RubyParameterNode)

            if local.kind == KEYWORD_REST_KIND
              declaration.has_keyword_rest = true
              next
            end

            next unless local.kind == KEYWORD_KIND

            name = local.name&.value

            declaration.add_local(name, local.required, default_source: local.default_value&.content) if name
          end
        end

        declaration
      end

      #: (Herb::AST::Node) -> Hash[String, Integer]?
      def self.location_of(node)
        start = node.location&.start

        return nil unless start

        { "line" => start.line, "column" => start.column }
      end

      #: (Hash[String, untyped]) -> PartialDeclaration
      def self.from(data)
        declaration = new(data["file"])
        declaration.has_declaration = data["hasDeclaration"] || false
        declaration.has_keyword_rest = data["hasKeywordRest"] || false
        declaration.location = data["location"]

        (data["locals"] || []).each do |local|
          declaration.add_local(local["name"], local["required"], default_source: local["defaultSource"])
        end

        declaration
      end

      #: (String) -> void
      def initialize(file)
        @file = file
        @has_declaration = false
        @has_keyword_rest = false
        @locals = [] #: Array[StrictLocal]
        @location = nil
      end

      #: (Hash[String, Integer]?) -> void
      attr_writer :location

      #: (String, bool, ?default_source: String?) -> void
      def add_local(name, required, default_source: nil)
        @locals << StrictLocal.new(name: name, required: required, default_source: default_source)
      end

      #: () -> Array[String]
      def required_locals
        @locals.select(&:required).map(&:name)
      end

      #: () -> Array[String]
      def optional_locals
        @locals.reject(&:required).map(&:name)
      end

      #: (String) -> bool
      def accepts?(local_name)
        return true if @has_keyword_rest
        return true unless @has_declaration

        @locals.any? { |local| local.name == local_name }
      end

      #: () -> Hash[String, untyped]
      def to_h
        {
          "file" => @file,
          "hasDeclaration" => @has_declaration,
          "hasKeywordRest" => @has_keyword_rest,
          "locals" => @locals.map(&:to_h)
        }.tap { |hash| hash["location"] = @location if @location }
      end
    end
  end
end
