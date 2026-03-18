# frozen_string_literal: true

module Herb
  module PrismInspect
    SKIP_FIELDS = [:node_id, :location, :flags].freeze

    class << self
      #: (String, String, String) -> String
      def inspect_prism_serialized(serialized_bytes, source, prefix)
        return "∅" unless serialized_bytes

        begin
          require "prism"
        rescue LoadError
          return "(#{serialized_bytes.bytesize} bytes, prism gem not available)"
        end

        node = Prism.load(source, serialized_bytes).value
        return "∅" unless node

        tree = inspect_prism_node(node, source, "#{prefix}    ")

        "\n#{prefix}└── #{tree.strip}"
      rescue StandardError => e
        "(#{serialized_bytes.bytesize} bytes, deserialize error: #{e.message})"
      end

      #: (Prism::Node, String, String) -> String
      def inspect_prism_node(node, source, prefix)
        output = +""
        node_name = node.class.name&.split("::")&.last || "Node"
        output << "@ #{node_name} (location: #{format_location(node.location)})\n"

        fields = display_fields(node)

        fields.each_with_index do |(name, value), i|
          is_last = i == fields.size - 1
          symbol = is_last ? "└── " : "├── "
          child_prefix = prefix + (is_last ? "    " : "│   ")

          output << inspect_field(name, value, source, prefix, symbol, child_prefix)
        end

        output
      end

      private

      #: (Symbol, untyped, String, String, String, String) -> String
      def inspect_field(name, value, source, prefix, symbol, child_prefix)
        case value
        when nil
          "#{prefix}#{symbol}#{name}: ∅\n"
        when Prism::Node
          inspect_node_field(name, value, source, prefix, symbol, child_prefix)
        when Array
          inspect_array_field(name, value, source, prefix, symbol, child_prefix)
        when Prism::Location
          "#{prefix}#{symbol}#{name}: #{format_location(value)}\n"
        when Symbol
          "#{prefix}#{symbol}#{name}: :#{value}\n"
        when Integer, Float, true, false
          "#{prefix}#{symbol}#{name}: #{value}\n"
        else
          "#{prefix}#{symbol}#{name}: #{value.inspect}\n"
        end
      end

      #: (Symbol, Prism::Node, String, String, String, String) -> String
      def inspect_node_field(name, value, source, prefix, symbol, child_prefix)
        output = +""

        output << "#{prefix}#{symbol}#{name}:\n"
        output << "#{child_prefix}└── "
        output << inspect_prism_node(value, source, "#{child_prefix}    ").lstrip

        output
      end

      #: (Symbol, Array[untyped], String, String, String, String) -> String
      def inspect_array_field(name, value, source, prefix, symbol, child_prefix)
        output = "#{prefix}#{symbol}#{name}: "

        if value.empty?
          output << "[]\n"
        else
          output << "(#{value.size} #{value.size == 1 ? "item" : "items"})\n"

          value.each_with_index do |item, j|
            is_last_item = j == value.size - 1
            item_symbol = is_last_item ? "└── " : "├── "
            item_prefix = child_prefix + (is_last_item ? "    " : "│   ")

            if item.is_a?(Prism::Node)
              output << "#{child_prefix}#{item_symbol}"
              output << inspect_prism_node(item, source, item_prefix).lstrip
            else
              output << "#{child_prefix}#{item_symbol}#{item.inspect}\n"
            end
          end
        end

        output
      end

      #: (untyped) -> Array[[Symbol, untyped]]
      def display_fields(node)
        node.deconstruct_keys(nil).except(*SKIP_FIELDS).to_a
      end

      #: (Prism::Location) -> String
      def format_location(location)
        start_line = location.start_line + 1
        end_line = location.end_line + 1

        "(#{start_line}:#{location.start_column})-(#{end_line}:#{location.end_column})"
      end
    end
  end
end
