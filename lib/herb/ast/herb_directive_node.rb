# frozen_string_literal: true
# typed: true

module Herb
  module AST
    class HerbDirectiveNode < Node
      #: () -> String
      def directive
        key&.value.to_s
      end

      #: () -> String
      def argument
        arguments&.value.to_s.strip
      end
    end
  end
end
