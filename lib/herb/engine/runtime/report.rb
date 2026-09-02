# frozen_string_literal: true
# typed: true

require "json"

require_relative "../../diagnostic"

module Herb
  class Engine
    module Runtime
      class Report
        VERSION = 1 #: Integer
        MAX_DIAGNOSTICS = 200 #: Integer
        ATTRIBUTE = "data-herb-diagnostics" #: String

        attr_reader :meta #: Hash[Symbol, untyped]
        attr_reader :sources #: Hash[String, String]
        attr_reader :nodes #: Hash[String, Hash[String, Hash[Symbol, untyped]]]
        attr_reader :render_tree #: Array[Hash[Symbol, untyped]]

        #: (?max_diagnostics: Integer) -> void
        def initialize(max_diagnostics: MAX_DIAGNOSTICS)
          @max_diagnostics = max_diagnostics
          @diagnostics = {} #: Hash[Array[untyped], Herb::Diagnostic]
          @meta = {} #: Hash[Symbol, untyped]
          @sources = {} #: Hash[String, String]
          @nodes = {} #: Hash[String, Hash[String, Hash[Symbol, untyped]]]
          @render_tree = [] #: Array[Hash[Symbol, untyped]]
          @channels = {} #: Hash[Symbol, untyped]
        end

        #: (Symbol) { () -> untyped } -> untyped
        def channel(name, &build)
          @channels[name] ||= build.call
        end

        #: () -> Array[untyped]
        def channels
          @channels.each_value.reject(&:empty?)
        end

        #: (Herb::Diagnostic) -> Herb::Diagnostic
        def add(diagnostic)
          @diagnostics[diagnostic.key] ||= diagnostic

          @diagnostics.shift while @diagnostics.size > @max_diagnostics

          diagnostic
        end

        #: (untyped) -> Report
        def concat(diagnostics)
          Array(diagnostics).each { |diagnostic| add(diagnostic) }

          self
        end

        #: (Symbol, untyped) -> void
        def note(key, value)
          @meta[key] = value if value

          nil
        end

        #: (String, String?) -> void
        def source(template, source)
          @sources[template] = source if source
        end

        #: (String, String?, String?, ?called_from: Array[untyped]?) -> void
        def render(id, template, parent, called_from: nil)
          node = { id: id, template: template, parent: parent } #: Hash[Symbol, untyped]

          if called_from
            node[:location] = Herb::Position.new(called_from[1], called_from[2]).to_one_based
            node[:via] = called_from[3]
          end

          @render_tree << node.compact

          nil
        end

        #: (String, Symbol, untyped, origin: String) -> void
        def annotate(id, key, value, origin:)
          node = @nodes[id] || {} #: Hash[String, Hash[Symbol, untyped]]
          annotations = node[origin] || {} #: Hash[Symbol, untyped]

          annotations[key] = value
          node[origin] = annotations
          @nodes[id] = node

          nil
        end

        #: () -> Array[Herb::Diagnostic]
        def diagnostics
          @diagnostics.values
        end

        #: () -> bool
        def empty?
          !reportable? && channels.empty?
        end

        #: () -> bool
        def noted?
          !@meta.empty?
        end

        #: () -> bool
        def reportable?
          !(@diagnostics.empty? && @nodes.empty?)
        end

        #: () -> Hash[Symbol, untyped]
        def to_h
          {
            version: VERSION,
            diagnostics: diagnostics.map(&:to_h),
            renderTree: @render_tree,
            nodes: @nodes,
            sources: sources,
          }.merge(@meta.empty? ? {} : { meta: @meta })
        end

        alias to_hash to_h

        #: (?untyped) -> String
        def to_json(state = nil)
          to_h.to_json(state)
        end

        #: () -> String
        def to_html
          %(<script type="application/json" #{ATTRIBUTE} data-count="#{@diagnostics.size}">#{escaped_json}</script>)
        end

        private

        #: () -> String
        def escaped_json
          to_json.gsub("<", "\\u003c")
        end
      end
    end
  end
end
