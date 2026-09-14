# frozen_string_literal: true

require "json"

require_relative "../../collector"
require_relative "../visitor"

module Herb
  class Engine
    module Slots
      module Manifest
        # What a set of templates says about itself, gathered without rendering any of them.
        #
        # A manifest is decided when a file is compiled, so everything a page needs to know about
        # its templates is knowable ahead of time. This compiles each file for that and nothing
        # else, which is what makes it possible to write the manifests into an asset and have
        # templates carry none of them:
        #
        #     collector = Herb::Engine::Slots::Manifest::Collector.new(project_path: root)
        #
        #     collector.add("app/views/posts/_card.html.erb")
        #     collector.add("app/views/posts/index.html.erb")
        #
        #     collector.to_json #=> the one file those templates add up to
        #
        # Which files to give it, and where the asset goes, is the job of whatever integrates Herb
        # with a framework. This knows how to compile and what to keep.
        #
        class Collector < Engine::Collector
          #: (?identifier: untyped?, ?project_path: (String | Pathname)?, **untyped) -> void
          def initialize(identifier: nil, **)
            super(**)

            @identifier = identifier
            @manifests = {} #: Hash[String, Hash[String, untyped]]
          end

          #: ((String | Pathname), ?String?) -> String?
          def add(file, source = nil)
            compile(file, source, Visitor.new(**{ mode: :client, mark: false, identifier: @identifier }.compact)) { |visitor|
              manifest = visitor.manifest

              next nil if manifest["names"].empty? && manifest["parts"].empty? && manifest["states"].nil?

              key = "#{visitor.identifier}:#{visitor.version}"
              @manifests[key] ||= manifest

              key
            }
          end

          #: () -> Hash[String, Hash[String, untyped]]
          def manifests
            @manifests.dup
          end

          #: () -> bool
          def empty?
            @manifests.empty?
          end

          #: () -> String
          def to_json(*)
            JSON.generate(@manifests, script_safe: true)
          end

          #: () -> String
          def inspect
            "#<#{self.class.name} manifests=#{@manifests.size} failures=#{@failures.size}>"
          end
        end
      end
    end
  end
end
