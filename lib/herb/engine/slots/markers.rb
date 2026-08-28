# frozen_string_literal: true
# typed: true

module Herb
  class Engine
    module Slots
      class Markers
        DEFAULT_TYPE = :child #: Symbol
        ITEM_STATICS = "item" #: String
        SEED_VALUE_TYPES = "[true, false, ::Integer, ::String, ::Symbol, nil]" #: String
        PREFIX = "herb-" #: String
        COMMENT = %r{\A<!--/?#{PREFIX}} #: Regexp

        #: (String) -> bool
        def self.marker?(text)
          COMMENT.match?(text)
        end

        #: (String) -> String
        def self.seeds_expression(pairs)
          "{ #{pairs} }.select { |_, v| #{SEED_VALUE_TYPES}.any? { |t| t === v } }.transform_values { |v| v.is_a?(::Symbol) ? v.to_s : v }"
        end

        #: (Integer, Symbol) -> String
        def slot_open(index, type)
          return "<!--#{PREFIX}slot:#{index}-->" if type == DEFAULT_TYPE

          "<!--#{PREFIX}slot:#{index}:#{type}-->"
        end

        #: (Array[[Integer, Symbol, String?]]) -> String
        def element_anchors(anchors)
          anchors.map { |index, type, name| name ? "#{index}:#{type}:#{name}" : "#{index}:#{type}" }.join(" ")
        end

        #: (Integer) -> String
        def slot_close(index)
          "<!--/#{PREFIX}slot:#{index}-->"
        end

        #: (Integer, Integer | String) -> String
        def branch(slot_index, branch_index)
          "<!--#{PREFIX}branch:#{slot_index}:#{branch_index}-->"
        end

        #: (Integer, Integer | String) -> String
        def statics_key(slot_index, branch_index)
          "#{slot_index}:#{branch_index}"
        end

        #: (Integer) -> String
        def item_statics_key(slot_index)
          statics_key(slot_index, ITEM_STATICS)
        end

        #: () -> String
        def seeds_open_prefix
          "<!--#{PREFIX}seeds:"
        end

        #: () -> String
        def seeds_open_suffix
          "-->"
        end

        #: (Integer) -> String
        def item_open_prefix(slot_index)
          "<!--#{PREFIX}item:#{slot_index}:"
        end

        #: () -> String
        def item_open_suffix
          "-->"
        end

        #: (Integer) -> String
        def item_close(slot_index)
          "<!--/#{PREFIX}item:#{slot_index}-->"
        end

        #: (String, String) -> String
        def region_open_prefix(file, version)
          "<!--#{PREFIX}region:#{file}:#{version}:"
        end

        #: () -> String
        def region_open_suffix
          "-->"
        end

        #: (String) -> String
        def region_close(file)
          "<!--/#{PREFIX}region:#{file}-->"
        end

        #: (String, String) -> String
        def statics_open(file, version)
          %(<template data-herb-region="#{file}:#{version}">)
        end

        #: () -> String
        def statics_close
          "</template>"
        end

        #: () -> String
        def manifests_open
          %(<template data-herb-manifests>)
        end

        #: () -> String
        def manifests_close
          "</template>"
        end
      end
    end
  end
end
