# frozen_string_literal: true

module ERBX
  module LibERBX
    attach_function :ast_node_type, [:pointer], :int
    attach_function :ast_node_type_to_string, [:pointer], :string
    attach_function :ast_node_children, [:pointer], :pointer
    attach_function :ast_node_child_count, [:pointer], :size_t
    attach_function :ast_pretty_print_node, [:pointer, :size_t, :size_t, :pointer], :void
    attach_function :ast_node_free, [:pointer], :void

    class ASTNode
      attr_reader :pointer

      def initialize(pointer)
        @pointer = pointer
      end

      def type_int
        LibERBX.ast_node_type(pointer)
      end

      def type
        LibERBX.ast_node_type_to_string(pointer)
      end

      def child_count
        LibERBX.ast_node_child_count(pointer)
      end

      def children
        LibERBX::Array.new(
          LibERBX.ast_node_children(pointer),
          ASTNode
        )
      end

      def inspect
        LibERBX::Buffer.with do |output|
          LibERBX.ast_pretty_print_node(pointer, 0, 0, output.pointer)

          output.read.force_encoding("utf-8") # TODO: remove force_encoding
        end
      end
    end
  end
end
