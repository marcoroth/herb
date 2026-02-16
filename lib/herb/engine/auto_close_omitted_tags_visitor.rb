# frozen_string_literal: true
# typed: false

require_relative "../../herb"

module Herb
  class Engine
    # Replaces omitted closing tags with explicit ones, so that the compiled output always
    # contains a closing tag, even when the template omits it.
    #
    # This visitor is not loaded by default. Require it explicitly and pass it to the engine:
    #
    #     require "herb/engine/auto_close_omitted_tags_visitor"
    #
    #     Herb::Engine.new(source, visitors: [Herb::Engine::AutoCloseOmittedTagsVisitor.new])
    #
    class AutoCloseOmittedTagsVisitor < Herb::Visitor
      #: (Herb::AST::HTMLElementNode) -> void
      def visit_html_element_node(node)
        close_tag = node.close_tag

        node.close_tag = explicit_close_tag(close_tag) if omitted_close_tag?(node) && close_tag.tag_name

        super
      end

      #: () -> String
      def inspect
        "#<#{self.class.name}>"
      end

      private

      #: (Herb::AST::HTMLOmittedCloseTagNode) -> Herb::AST::HTMLCloseTagNode
      def explicit_close_tag(omitted_close_tag)
        Herb::AST::HTMLCloseTagNode.new(
          "HTMLCloseTagNode",
          omitted_close_tag.location,
          [],
          token("</", "TOKEN_HTML_TAG_START_CLOSE", omitted_close_tag.location),
          omitted_close_tag.tag_name,
          [],
          token(">", "TOKEN_HTML_TAG_END", omitted_close_tag.location)
        )
      end

      #: (String, String, Herb::Location?) -> Herb::Token
      def token(value, type, location)
        Herb::Token.new(value.dup, Herb::Range.from(0, 0), location || Herb::Location.from(0, 0, 0, 0), type)
      end
    end
  end
end
