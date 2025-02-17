# frozen_string_literal: true

require "forwardable"

module ERBX
  class ParseResult
    extend Forwardable

    def_delegators :@root_node, :type, :child_count

    attr_accessor :root_node

    def initialize(pointer)
      @root_node = LibERBX::ASTNode.new(pointer)
    end
  end
end
