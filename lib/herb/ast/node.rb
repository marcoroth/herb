# frozen_string_literal: true
# typed: true

module Herb
  #: type serialized_node = {
  #|  type: String,
  #|  location: serialized_location?,
  #|  errors: Array[serialized_error]
  #| }
  module AST
    class Node
      attr_reader :type #: String
      attr_reader :location #: Location
      attr_reader :errors #: Array[Herb::Errors::Error]

      #: (String, Location, ?Array[Herb::Errors::Error]) -> void
      def initialize(type, location, errors = [])
        @type = type
        @location = location
        @errors = errors
      end

      #: () -> serialized_node
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

      #: (
      #|   Array[Herb::AST::Node|Herb::Errors::Error],
      #|   ?item_name: String,
      #|   ?prefix: String,
      #|   ?indent: Integer,
      #|   ?depth: Integer,
      #|   ?depth_limit: Integer
      #| ) -> String
      def inspect_array(array, item_name: "item", prefix: "    ", indent: 0, depth: 0, depth_limit: 25)
        output = +""

        if array.any?
          output += "(#{array.count} #{array.one? ? item_name : "#{item_name}s"})"
          output += "\n"

          items = array.map { |item|
            kwargs = { indent: indent, depth: depth, depth_limit: depth_limit }

            if array.last == item
              "└── #{item.tree_inspect(**kwargs).gsub(/^/, "    ").lstrip}"
            else
              "├── #{item.tree_inspect(**kwargs).gsub(/^/, "│   ")}".gsub("├── │  ", "├──")
            end
          }

          output += items.join.gsub(/^/, prefix)
        else
          output += "[]"
          output += "\n"
        end

        output
      end

      #: (?indent: Integer, ?depth: Integer, ?depth_limit: Integer) -> String
      def tree_inspect(indent: 0, depth: 0, depth_limit: 25)
        raise NotImplementedError
      end

      #: (Visitor) -> void
      def accept(_visitor)
        raise NoMethodError, "undefined method `accept' for #{inspect}"
      end

      #: () -> Array[Herb::AST::Node?]
      def child_nodes
        raise NoMethodError, "undefined method `child_nodes' for #{inspect}"
      end

      alias deconstruct child_nodes

      #: () -> Array[Herb::AST::Node]
      def compact_child_nodes
        child_nodes.compact
      end

      #: () -> Array[Herb::Errors::Error]
      def recursive_errors
        errors + compact_child_nodes.flat_map(&:recursive_errors)
      end
    end
  end
end
