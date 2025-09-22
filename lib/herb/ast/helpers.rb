# frozen_string_literal: true
# typed: true

module Herb
  module AST
    module Helpers
      #: (Herb::AST::Node) -> bool
      def erb_outputs?(node)
        return false unless node.is_a?(Herb::AST::ERBContentNode)

        opening = node.tag_opening&.value
        opening&.include?("=") && !opening&.start_with?("<%#")
      end

      #: (String) -> bool
      def erb_comment?(opening)
        opening.start_with?("<%#")
      end

      #: (String) -> bool
      def erb_output?(opening)
        opening.include?("=")
      end
    end
  end
end
