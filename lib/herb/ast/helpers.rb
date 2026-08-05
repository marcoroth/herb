# frozen_string_literal: true
# typed: true

module Herb
  module AST
    module Helpers
      #: (Herb::AST::Node?) -> bool
      def erb_outputs?(node)
        return false unless node.is_a?(Herb::AST::ERBContentNode)

        opening = node.tag_opening&.value || ""
        opening.include?("=") && !opening.start_with?("<%#")
      end

      #: (String) -> bool
      def erb_comment?(opening)
        opening.start_with?("<%#")
      end

      #: (String) -> bool
      def erb_graphql?(opening)
        opening.start_with?("<%graphql")
      end

      #: (String) -> bool
      def erb_output?(opening)
        opening.include?("=")
      end

      #: (Herb::AST::Node?) -> Herb::AST::HTMLOmittedCloseTagNode?
      def omitted_close_tag(node)
        return nil unless node.is_a?(Herb::AST::HTMLElementNode)

        close_tag = node.close_tag

        close_tag if close_tag.is_a?(Herb::AST::HTMLOmittedCloseTagNode)
      end

      #: (Herb::AST::Node?) -> bool
      def omitted_close_tag?(node)
        !omitted_close_tag(node).nil?
      end

      #: (Herb::AST::ERBContentNode) -> bool
      def inline_ruby_comment?(node)
        return false unless node.is_a?(Herb::AST::ERBContentNode)
        return false if erb_comment?(node.tag_opening&.value || "")

        content = node.content&.value || ""
        stripped = content.lstrip

        stripped.start_with?("#") && node.location.start.line == node.location.end.line
      end
    end
  end
end
