# frozen_string_literal: true
# typed: ignore

# rbs_inline: disabled

module Herb
  module LibHerb
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
        LibHerb.ast_node_type(pointer)
      end

      def type
        LibHerb.ast_node_type_to_string(pointer)
      end

      def child_count
        LibHerb.ast_node_child_count(pointer)
      end

      def children
        LibHerb::Array.new(
          LibHerb.ast_node_children(pointer),
          ASTNode
        )
      end

      def inspect
        LibHerb::Buffer.with do |output|
          LibHerb.ast_pretty_print_node(pointer, 0, 0, output.pointer)

          output.read.force_encoding("utf-8") # TODO: remove force_encoding
        end
      end
    end
  end
end
