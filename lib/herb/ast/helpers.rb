# frozen_string_literal: true
# typed: true

module Herb
  module AST
    module Helpers
      #: (Herb::AST::Node?) -> bool
      def erb_node?(node)
        !erb_opening(node).empty?
      end

      #: (Herb::AST::Node?) -> String
      def erb_opening(node)
        token = case node
                when Herb::AST::ERBContentNode, Herb::AST::ERBRenderNode, Herb::AST::ERBBlockNode, Herb::AST::ERBIterationBlockNode
                  node.tag_opening
                end

        token&.value.to_s
      end

      #: (Herb::AST::Node?) -> bool
      def erb_outputs?(node)
        return false unless erb_node?(node)

        erb_output?(erb_opening(node))
      end

      #: (Herb::AST::Node?) -> bool
      def erb_statement?(node)
        return false unless erb_node?(node)

        opening = erb_opening(node)

        opening.start_with?("<%") && !erb_output?(opening) && !erb_comment?(opening)
      end

      #: (String) -> bool
      def erb_comment?(opening)
        opening.start_with?("<%#")
      end

      #: (Herb::AST::Node?) -> bool
      def erb_comment_node?(node)
        return false unless node.is_a?(Herb::AST::ERBContentNode)

        erb_comment?(erb_opening(node)) || inline_ruby_comment?(node)
      end

      #: (String) -> bool
      def erb_custom_opening?(opening)
        opening.start_with?("<%") && !Herb.default_erb_openings.include?(opening)
      end

      #: (String) -> bool
      def erb_omitted?(opening)
        erb_comment?(opening) || erb_custom_opening?(opening)
      end

      #: (String) -> bool
      def erb_escaped?(opening)
        opening.start_with?("<%%")
      end

      #: (String) -> bool
      def erb_output?(opening)
        opening.include?("=") && !erb_comment?(opening)
      end

      #: (Herb::AST::Node?) -> Herb::AST::HTMLOmittedCloseTagNode?
      def omitted_close_tag(node)
        return nil unless node.is_a?(Herb::AST::HTMLElementNode)

        close_tag = node.close_tag

        return unless close_tag.is_a?(Herb::AST::HTMLOmittedCloseTagNode)

        close_tag
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

        stripped.start_with?("#") && !content.include?("\n")
      end
    end
  end
end
