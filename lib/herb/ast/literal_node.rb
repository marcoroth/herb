# frozen_string_literal: true
# typed: true
# rbs_inline: enabled

module Herb
  module AST
    class LiteralNode < Node
      #: (String) -> LiteralNode
      def self.from(value)
        new("LiteralNode", Location.zero, [], value.to_s.dup)
      end
    end
  end
end
