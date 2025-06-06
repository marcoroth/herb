# frozen_string_literal: true
# typed: true

module Herb
  module AST
    class Node
      #: String
      attr_reader :type

      #: Location
      attr_reader :location

      #: Array[Herb::Errors::Error]
      attr_reader :errors

      #: (String, Location, Array[Herb::Errors::Error]) -> void
      def initialize(type, location, errors)
        @type = type
        @location = location
        @errors = errors
      end

      #: () -> { type: String, location: { line: Integer, column: Integer, length: Integer }, errors: Array[{ type: String, location: { start: { line: Integer, column: Integer }, end: { line: Integer, column: Integer } }, message: String }]}
      def to_hash
        {
          type: type,
          location: location.to_hash,
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

      #: (?untyped) -> String
      def to_json(state = nil)
        to_hash.to_json(state)
      end

      #: (?prefix: String) -> String
      def inspect_errors(prefix: "    ")
        return "" if errors.empty?

        "├── errors: #{inspect_array(errors, item_name: "error", prefix: prefix)}"
      end

      #: (Array[Herb::AST::Node|Herb::Errors::Error], ?item_name: String, ?prefix: String) -> String
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

      #: (?Integer) -> String
      def tree_inspect(_indent = 0)
        raise NotImplementedError
      end
    end
  end
end
