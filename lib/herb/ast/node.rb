# frozen_string_literal: true
# typed: true

module Herb
  module AST
    class Node
      attr_reader :type #: String
      attr_reader :location #: Location
      attr_reader :errors #: Array[Herb::Errors::Error]

      #: (type: String, location: Location, errors: Array[Herb::Errors::Error]) -> void
      def initialize(type, location, errors = [])
        @type = type
        @location = location
        @errors = errors
      end

      # TODO: update error type
      #: () -> { type: String, location: { start: { line: Integer, column: Integer }, end: { line: Integer, column: Integer } }?, errors: Array }
      def to_hash
        {
          type: type,
          location: location&.to_hash,
          errors: errors.map(&:to_hash),
        }
      end

      #: () -> String
      def class_name
        self.class.name || "Node"
      end

      #: () -> String
      def node_name
        class_name.split("::").last || "Node"
      end

      #: (?untyped, ?untyped) -> String
      def to_json(state = nil, options = nil)
        to_hash.to_json(state, options)
      end

      #: (prefix: String) -> String
      def inspect_errors(prefix: "    ")
        return "" if errors.empty?

        "├── errors: #{inspect_array(errors, item_name: "error", prefix: prefix)}"
      end

      #: (array: Array, item_name: String, prefix: String) -> String
      def inspect_array(array, item_name: "item", prefix: "    ")
        output = +""

        if array.any?
          output += "(#{array.count} #{array.count == 1 ? item_name : "#{item_name}s"})"
          output += "\n"

          items = array.map { |item|
            if array.last == item
              "└── #{item.tree_inspect.gsub(/^/, "    ").lstrip}"
            else
              "├── #{item.tree_inspect.gsub(/^/, "│   ")}".gsub("├── │  ", "├──")
            end
          }

          output += items.join.gsub(/^/, prefix)
        else
          output += "[]"
          output += "\n"
        end

        output
      end
    end
  end
end
