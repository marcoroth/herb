# frozen_string_literal: true
# typed: true

module Herb
  class Engine
    class SlotMarkers
      DEFAULT_TYPE = :child #: Symbol

      #: (Integer, Symbol) -> String
      def slot_open(index, type)
        return "<!--herb-slot:#{index}-->" if type == DEFAULT_TYPE

        "<!--herb-slot:#{index}:#{type}-->"
      end

      #: (Array[[Integer, Symbol, String?]]) -> String
      def element_anchors(anchors)
        anchors.map { |index, type, name| name ? "#{index}:#{type}:#{name}" : "#{index}:#{type}" }.join(",")
      end

      #: (Integer) -> String
      def child_anchor(index)
        index.to_s
      end

      #: (Integer) -> String
      def slot_close(index)
        "<!--/herb-slot:#{index}-->"
      end

      #: (Integer, Integer) -> String
      def branch(slot_index, branch_index)
        "<!--herb-branch:#{slot_index}:#{branch_index}-->"
      end

      #: (Integer) -> String
      def row_open_prefix(slot_index)
        "<!--herb-row:#{slot_index}:"
      end

      #: () -> String
      def row_open_suffix
        "-->"
      end

      #: (Integer) -> String
      def row_close(slot_index)
        "<!--/herb-row:#{slot_index}-->"
      end

      #: (String, String) -> String
      def region_open(file, version)
        "<!--herb-region:#{file}:#{version}-->"
      end

      #: (String) -> String
      def region_close(file)
        "<!--/herb-region:#{file}-->"
      end

      #: (String, String) -> String
      def statics_open(file, version)
        %(<template data-herb-region="#{file}:#{version}">)
      end

      #: () -> String
      def statics_close
        "</template>"
      end
    end
  end
end
