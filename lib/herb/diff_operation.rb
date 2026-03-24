# frozen_string_literal: true
# typed: true

module Herb
  class DiffOperation
    attr_reader :type #: Symbol
    attr_reader :path #: Array[Integer]
    attr_reader :old_node #: Herb::AST::Node?
    attr_reader :new_node #: Herb::AST::Node?
    attr_reader :old_index #: Integer
    attr_reader :new_index #: Integer

    #: (Symbol, Array[Integer], Herb::AST::Node?, Herb::AST::Node?, Integer, Integer) -> void
    def initialize(type, path, old_node, new_node, old_index, new_index) # rubocop:disable Metrics/ParameterLists
      @type = type
      @path = path
      @old_node = old_node
      @new_node = new_node
      @old_index = old_index
      @new_index = new_index
    end

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
