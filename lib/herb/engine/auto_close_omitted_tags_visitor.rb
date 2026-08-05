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
        omitted = omitted_close_tag(node)
        tag_name = omitted&.tag_name

        node.close_tag = explicit_close_tag(tag_name, omitted.location) if omitted && tag_name

        super
      end

      #: () -> String
      def inspect
        "#<#{self.class.name}>"
      end

      private

      #: (Herb::Token, Herb::Location) -> Herb::AST::HTMLCloseTagNode
      def explicit_close_tag(tag_name, location)
        Herb::AST::HTMLCloseTagNode.new(
          "HTMLCloseTagNode",
          location,
          [],
          token("</", "TOKEN_HTML_TAG_START_CLOSE", location),
          tag_name,
          [],
          token(">", "TOKEN_HTML_TAG_END", location)
        )
      end

      #: (String, String, Herb::Location) -> Herb::Token
      def token(value, type, location)
        Herb::Token.new(value.dup, Herb::Range.from(0, 0), location, type)
      end
    end
  end
end
