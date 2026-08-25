# frozen_string_literal: true

require "pathname"

require_relative "../../../herb"
require_relative "visitor"

module Herb
  class Engine
    module ScopedStyle
      # The CSS a set of templates scoped, gathered without rendering any of them.
      #
      # A scope and its CSS are decided when a file is compiled, so everything a stylesheet needs is
      # knowable ahead of time. This compiles each file for that and nothing else, which is what makes
      # it possible to write the CSS into an asset and have templates emit none of it:
      #
      #     collector = Herb::Engine::ScopedStyle::Collector.new(transform: transform, project_path: root)
      #
      #     collector.add("app/views/posts/_card.html.erb")
      #     collector.add("app/views/posts/index.html.erb")
      #
      #     collector.to_css #=> the one stylesheet those files add up to
      #
      # Which files to give it, and where the stylesheet goes, is the job of whatever integrates Herb
      # with a framework. This knows how to compile and what to keep.
      #
      class Collector
        Failure = Data.define(:file, :error)

        attr_reader :failures #: Array[Failure]

        #: (transform: untyped, ?project_path: (String | Pathname)?, **untyped) -> void
        def initialize(transform:, project_path: nil, **options)
          @transform = transform
          @project_path = Pathname.new(project_path || Dir.pwd).expand_path
          @options = options
          @styles = {} #: Hash[String, String]
          @files = {} #: Hash[String, Array[String]]
          @failures = [] #: Array[Failure]
        end

        #: ((String | Pathname)) -> Array[String]
        def add(file, source = nil)
          visitor = Visitor.new(transform: @transform, deliver: :none)

          Engine.new(source || read(file), **engine_options(file, visitor))

          visitor.styles.each { |scope, css| @styles[scope] ||= css }

          @files[file.to_s] = visitor.styles.keys

          visitor.styles.keys
        rescue StandardError => e
          @failures << Failure.new(file: file.to_s, error: e)

          []
        end

        #: () -> Hash[String, String]
        def styles
          @styles.dup
        end

        #: () -> Hash[String, Array[String]]
        def files
          @files.dup
        end

        #: () -> bool
        def empty?
          @styles.empty?
        end

        #: () -> String
        def to_css
          @styles.values.join("\n")
        end

        #: () -> String
        def inspect
          "#<#{self.class.name} scopes=#{@styles.size} files=#{@files.size} failures=#{@failures.size}>"
        end

        private

        #: ((String | Pathname)) -> String
        def read(file)
          File.read(file)
        end

        #: ((String | Pathname), untyped) -> Hash[Symbol, untyped]
        def engine_options(file, visitor)
          @options.merge(
            filename: Pathname.new(file).expand_path.to_s,
            project_path: @project_path.to_s,
            visitors: [*@options[:visitors], visitor]
          )
        end
      end
    end
  end
end
