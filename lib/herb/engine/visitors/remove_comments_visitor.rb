# frozen_string_literal: true
# typed: false

require_relative "../../../herb"
require_relative "../slots/markers"

module Herb
  class Engine
    # Removes comments from the template, so that the compiled output never contains one.
    #
    # An HTML comment is served to the browser and is readable by anyone who looks at the page
    # source, so a note the template author wrote for other developers ends up in production.
    # This drops every `<!-- -->` comment, along with everything nested inside it, before the
    # compiler sees the template. ERB inside a removed comment is dropped with it and never runs.
    #
    # ERB comments go too. The compiler already leaves `<%# comment %>` and `<% # comment %>` out
    # of the output on its own, so removing them makes it something the template is guaranteed
    # instead of something the compiler happens to do.
    #
    # What Herb writes to itself is not a comment. A directive, which is an ERB comment whose
    # content starts with `herb:` or `locals:`, is an instruction to Herb or to Action View
    # instead of a note for people, so `<%# herb:state %>`, `<%# herb:key %>`,
    # `<%# herb:disable %>` and `<%# locals: (title:) %>` all stay where they are. The compiler
    # leaves them out of the output the same way it leaves any ERB comment out.
    #
    # A marker, which `Slots::Markers` recognizes, is how a pass hands something to the browser,
    # the way `Slots::Visitor` writes `<!--herb-slot:0-->` around a slot. Those stay too, in the
    # output as well, so this visitor can run before or after the pass that writes them.
    #
    # Whitespace around a comment is left alone, so removing one never changes how the elements
    # next to it are laid out. A comment on a line of its own leaves that line's whitespace
    # behind, an ERB comment included, which the compiler on its own would have trimmed away with
    # the line.
    #
    # Comment syntax inside a `<script>` or `<style>` element is part of that element's text
    # instead of an HTML comment, so it stays. A conditional comment is an HTML comment, so it
    # goes, and the markup it guards goes with it.
    #
    # This visitor is not loaded by default. Require it explicitly and pass it to the engine:
    #
    #     require "herb/engine/visitors/remove_comments_visitor"
    #
    #     Herb::Engine.new(source, visitors: [Herb::Engine::RemoveCommentsVisitor.new])
    #
    class RemoveCommentsVisitor < Herb::Visitor
      CHILD_LISTS = [:children, :body, :statements].freeze #: Array[Symbol]
      DIRECTIVE = /\A\s*-?\s*#?\s*(?:herb:|locals:)/ #: Regexp

      #: (Herb::AST::Node) -> void
      def visit_node(node)
        CHILD_LISTS.each do |name|
          next unless node.respond_to?(name)

          children = node.public_send(name)

          next unless children.is_a?(Array)

          children.reject! { |child| comment?(child) }
        end
      end

      #: () -> String
      def inspect
        "#<#{self.class.name}>"
      end

      private

      #: (Herb::AST::Node?) -> bool
      def comment?(node)
        case node
        when Herb::AST::HTMLCommentNode
          !marker?(node)
        when Herb::AST::ERBContentNode
          erb_comment_node?(node) && !directive?(node)
        else
          false
        end
      end

      #: (Herb::AST::HTMLCommentNode) -> bool
      def marker?(node)
        Slots::Markers.marker?(comment_text(node))
      end

      #: (Herb::AST::HTMLCommentNode) -> String
      def comment_text(node)
        first = (node.children || []).first

        opening = case first
                  when Herb::AST::LiteralNode, Herb::AST::HTMLTextNode
                    first.content.to_s
                  else
                    ""
                  end

        "#{node.comment_start&.value}#{opening}"
      end

      #: (Herb::AST::ERBContentNode) -> bool
      def directive?(node)
        DIRECTIVE.match?(node.content&.value.to_s)
      end
    end
  end
end
