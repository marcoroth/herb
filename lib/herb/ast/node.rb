# frozen_string_literal: true

module Herb
  module AST
    class Node
      attr_reader :type, :location, :errors

      def initialize(type, location, errors = [])
        @type = type
        @location = location
        @errors = errors
      end

      def to_hash
        {
          type: type,
          location: location&.to_hash,
          errors: errors.map(&:to_hash),
        }
      end

      def node_name
        self.class.name.split("::").last
      end

      def to_json(*args)
        to_hash.to_json(*args)
      end

      def inspect_errors(prefix: "    ")
        return "" if errors.empty?

        "├── errors: #{inspect_array(errors, item_name: "error", prefix: prefix)}"
      end

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
