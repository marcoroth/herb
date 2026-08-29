# frozen_string_literal: true
# typed: false

require "pathname"

require_relative "context/origin"

module Herb
  class Visitor
    # Per-template information the engine hands to the visitors it runs before compilation.
    #
    # Alongside the template path, it carries the options the engine was built with, and any
    # additional keys the caller wants to pass through to its own visitors:
    #
    #     Herb::Engine.new(source, filename: path, context: { theme: "dark" }, visitors: [MyVisitor.new])
    #
    #     class MyVisitor < Herb::Visitor
    #       include Herb::Visitor::ContextAware
    #
    #       def visit_html_element_node(node)
    #         context.relative_file_path #=> "app/views/users/show.html.erb"
    #         context.options[:escape]   #=> true
    #         context[:theme]            #=> "dark"
    #
    #         super
    #       end
    #     end
    #
    class Context
      UNKNOWN_FILE_PATH = "unknown" #: String

      attr_reader :file_path #: Pathname?
      attr_reader :options #: Hash[Symbol, untyped]
      attr_reader :data #: Hash[Symbol, untyped]

      #: (?file_path: (String | Pathname)?, ?project_path: (String | Pathname)?, ?options: Hash[Symbol, untyped], **untyped) -> void
      def initialize(file_path: nil, project_path: nil, options: {}, **data)
        @file_path = self.class.coerce_file_path(file_path)
        @project_path_cache = [] #: Array[Pathname]
        @project_path_cache << self.class.coerce_project_path(project_path) if project_path
        @relative_file_path_cache = [] #: Array[String]
        @options = options.dup.freeze
        @data = data.tap { |values| values[:origin] ||= Origin.new }.freeze

        freeze
      end

      #: () -> Pathname
      def project_path
        @project_path_cache[0] ||= self.class.coerce_project_path(nil)
      end

      #: () -> String
      def relative_file_path
        @relative_file_path_cache[0] ||= self.class.derive_relative_file_path(file_path, project_path)
      end

      #: () -> Herb::Visitor::Context::Origin
      def origin
        data[:origin]
      end

      #: (Symbol) -> untyped
      def [](key)
        case key
        when :file_path then file_path
        when :project_path then project_path
        when :relative_file_path then relative_file_path
        when :options then options
        else data[key]
        end
      end

      #: (Symbol) -> bool
      def key?(key)
        [:file_path, :project_path, :relative_file_path, :options].include?(key) || data.key?(key)
      end

      #: (Symbol, ?untyped) -> untyped
      def fetch(key, *default)
        return self[key] if key?(key)
        return default.first unless default.empty?

        raise KeyError, "key not found: #{key.inspect}"
      end

      #: (**untyped) -> Herb::Visitor::Context
      def merge(**extra)
        self.class.new(
          file_path: extra.fetch(:file_path, file_path),
          project_path: extra.fetch(:project_path, project_path),
          options: extra.fetch(:options, options),
          **data.merge(extra.except(:file_path, :project_path, :options))
        )
      end

      #: () -> Hash[Symbol, untyped]
      def to_hash
        {
          file_path: file_path,
          project_path: project_path,
          relative_file_path: relative_file_path,
          options: options,
          data: data,
        }
      end

      alias to_h to_hash

      #: () -> String
      def inspect
        "#<#{self.class.name} file_path=#{file_path.to_s.inspect} relative_file_path=#{relative_file_path.inspect}>"
      end

      #: ((String | Pathname)?) -> Pathname?
      def self.coerce_file_path(file_path)
        case file_path
        when ::Pathname then file_path
        when String then file_path.empty? ? nil : ::Pathname.new(file_path)
        end
      end

      #: ((String | Pathname)?) -> Pathname
      def self.coerce_project_path(project_path)
        case project_path
        when ::Pathname then project_path
        when String then ::Pathname.new(project_path)
        else ::Pathname.new(Dir.pwd)
        end
      end

      #: (Pathname?, Pathname) -> String
      def self.derive_relative_file_path(file_path, project_path)
        return UNKNOWN_FILE_PATH unless file_path

        absolute = file_path.absolute? ? file_path : project_path + file_path

        absolute.relative_path_from(project_path).to_s
      rescue ArgumentError
        file_path.to_s
      end
    end
  end
end
