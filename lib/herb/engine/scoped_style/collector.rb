# frozen_string_literal: true

require_relative "../../../herb"
require_relative "../collector"
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
      class Collector < Engine::Collector
        #: (transform: untyped, ?project_path: (String | Pathname)?, **untyped) -> void
        def initialize(transform:, **)
          super(**)

          @transform = transform
          @styles = {} #: Hash[String, String]
          @files = {} #: Hash[String, Array[String]]
        end

        #: ((String | Pathname), ?String?) -> Array[String]
        def add(file, source = nil)
          compile(file, source, Visitor.new(transform: @transform, deliver: :none)) { |visitor|
            visitor.styles.each { |scope, css| @styles[scope] ||= css }

            @files[file.to_s] = visitor.styles.keys

            visitor.styles.keys
          } || []
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
      end
    end
  end
end
