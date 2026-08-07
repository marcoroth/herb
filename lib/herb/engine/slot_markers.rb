# frozen_string_literal: true
# typed: true

module Herb
  class Engine
    class SlotMarkers
      #: (Integer, Symbol) -> String
      def slot_open(index, _type)
        "<!--herb-slot:#{index}-->"
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
    end
  end
end
