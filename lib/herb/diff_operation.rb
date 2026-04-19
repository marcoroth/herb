# frozen_string_literal: true
# typed: true

module Herb
  DiffOperation = Data.define(
    :type, #: Symbol
    :path, #: Array[Integer]
    :old_node, #: Herb::AST::Node?
    :new_node, #: Herb::AST::Node?
    :old_index, #: Integer
    :new_index #: Integer
  )

  class DiffOperation
    #: () -> Hash[Symbol, untyped]
    def to_hash
      {
        type: type,
        path: path,
        old_node: old_node,
        new_node: new_node,
        old_index: old_index,
        new_index: new_index,
      }
    end

    alias to_h to_hash

    #: () -> String
    def inspect
      "#<#{self.class.name} type=#{type} path=[#{path.join(", ")}]>"
    end
  end
end
