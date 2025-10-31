# frozen_string_literal: true
# typed: ignore

# rbs_inline: disabled

require "forwardable"

module Herb
  class ParseResult
    extend Forwardable

    def_delegators :@root_node, :type, :child_count

    attr_accessor :root_node

    def initialize(pointer)
      @root_node = LibHerb::ASTNode.new(pointer)
    end
  end
end
