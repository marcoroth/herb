# frozen_string_literal: true

module ERBX
  module LibERBX
    attach_function :ast_node_name, [:pointer], :string
    attach_function :ast_node_type, [:pointer], :int
    attach_function :ast_node_type_to_string, [:pointer], :string
    attach_function :ast_node_children_count, [:pointer], :size_t

    class ASTNode
      attr_reader :pointer

      def initialize(pointer)
        @pointer = pointer
      end

      def name
        LibERBX.ast_node_type(pointer)
      end

      def type_int
        LibERBX.ast_node_type(pointer)
      end

      def type
        LibERBX.ast_node_type_to_string(pointer)
      end

      def child_count
        LibERBX.ast_node_children_count(pointer)
      end

      def inspect
        %(#<#{self.class} name=#{name} type=#{type} type_int=#{type_int} child_count=#{child_count} pointer=#{pointer}>)
      end
    end
  end
end
