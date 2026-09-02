# frozen_string_literal: true
# typed: false

require_relative "../../../herb"
require_relative "../../engine"
require_relative "../../visitor/context_aware"
require_relative "../../visitor/context/origin"

module Herb
  class Engine
    # Stamps every element with the template and the position it was written at, so that something
    # found on the rendered page can be pointed back at the line that produced it.
    #
    # Some things are only visible once a page is rendered. Two partials can each be valid on their
    # own and still collide on an `id`, a heading order only exists once a layout and everything it
    # renders are composed, and a `<form>` inside another `<form>` is usually two templates that
    # never see each other. Linting the response is what answers those, and the positions it reports
    # are offsets into the response, which is not a place anyone can go and fix anything. This is
    # what turns them back into a file and a line.
    #
    #     require "herb/engine/visitors/source_attribution_visitor"
    #
    #     Herb::Engine.new(source, filename: path, visitors: [
    #       Herb::Engine::SourceAttributionVisitor.new
    #     ])
    #
    #     #=> <div data-herb-source="app/views/posts/_card.html.erb:8:3">
    #
    # A tag helper is stamped too. The `action_view_helpers` parser option turns
    # `<%= link_to "Home", "/" %>` into an `<a>` that the compiler writes out as markup, and that
    # `<a>` is stamped at the position of the `<%=` that asked for it.
    #
    #     #=> <a href="/" data-herb-source="app/views/posts/_card.html.erb:4:5">Home</a>
    #
    # That option is recommended here, so a stack that says nothing about it gets it. It is worth
    # knowing that it decides more than attribution does. It is also what makes the compiler write
    # a helper out as markup instead of calling it while the page renders, which is the same thing
    # `OptimizeVisitor` and `Slots::Visitor` require it for. A host that wants its helpers called at
    # render time sets `action_view_helpers: false` and takes the warning that comes with it, and
    # everything written as literal markup is stamped either way.
    #
    # A helper the parser cannot resolve to a tag stays an ERB node with no element around it, so
    # `form_with` and anything the host defined itself reach the response carrying nothing, and the
    # nearest stamped ancestor is what places them.
    #
    # Nothing is wrapped to close that gap. A wrapper element inside `<ul>`, `<table>` or `<select>`
    # is invalid markup, and it would be Herb's own markup tripping the structural rules this exists
    # to run. An unstamped element is a worse answer that stays true. A wrong one would not.
    #
    # A partial that `InlineRender::Visitor` brought into this template is stamped with the file it
    # was written in, not the file it was inlined into.
    #
    # The stamp is markup Herb added, so a consumer is expected to strip it before reporting
    # positions back, and to leave the visitor out of anything but a development build.
    #
    class SourceAttributionVisitor < Herb::Visitor
      include Herb::Visitor::ContextAware

      required_parser_option track_locations: true
      recommended_parser_option action_view_helpers: true

      ATTRIBUTE = "data-herb-source" #: String

      #: (?attribute: String) -> void
      def initialize(attribute: ATTRIBUTE)
        super()

        @attribute = attribute.downcase
        @file = nil #: String?
      end

      #: (Herb::AST::HTMLElementNode) -> void
      def visit_html_element_node(node)
        stamp(node.open_tag)

        super
      end

      #: (Herb::AST::Node) -> void
      def visit_child_nodes(node)
        entry = origin.of(node)

        return super unless entry

        outer = @file
        @file = entry.file

        super

        @file = outer
      end

      #: () -> String
      def inspect
        return "#<#{self.class.name}>" if @attribute == ATTRIBUTE

        "#<#{self.class.name} attribute=#{@attribute.inspect}>"
      end

      private

      #: () -> String
      def current_file
        @file || context.relative_file_path
      end

      #: (Herb::AST::Node?) -> void
      def stamp(open_tag)
        return unless open_tag.is_a?(Herb::AST::HTMLOpenTagNode) || open_tag.is_a?(Herb::AST::ERBOpenTagNode)
        return if stamped?(open_tag)

        position = position_of(open_tag)

        return unless position

        value = "#{current_file}:#{position[:line]}:#{position[:column]}"

        open_tag.children << attribute_node(@attribute, value)

        nil
      end

      #: ((Herb::AST::HTMLOpenTagNode | Herb::AST::ERBOpenTagNode)) -> Herb::serialized_position?
      def position_of(open_tag)
        start = open_tag.location&.start

        return nil unless start
        return nil if start.line.zero?

        start.to_one_based
      end

      #: ((Herb::AST::HTMLOpenTagNode | Herb::AST::ERBOpenTagNode)) -> bool
      def stamped?(open_tag)
        open_tag.children.any? { |child|
          child.is_a?(Herb::AST::HTMLAttributeNode) && attribute_name(child) == @attribute
        }
      end

      #: (Herb::AST::HTMLAttributeNode) -> String?
      def attribute_name(node)
        children = node.name&.children

        return nil unless children

        name = children.filter_map { |child| child.content if child.is_a?(Herb::AST::LiteralNode) }.join

        name.empty? ? nil : name.downcase
      end

      #: (String, String) -> Herb::AST::HTMLAttributeNode
      def attribute_node(name, value)
        name_node = Herb::AST::HTMLAttributeNameNode.build(
          children: [Herb::AST::LiteralNode.build(content: +name)]
        )

        value_node = Herb::AST::HTMLAttributeValueNode.build(
          open_quote: Herb::Token.from(:quote, '"'),
          children: [Herb::AST::LiteralNode.build(content: Herb::Engine.h(value))],
          close_quote: Herb::Token.from(:quote, '"'),
          quoted: true
        )

        Herb::AST::HTMLAttributeNode.build(
          name: name_node,
          equals: Herb::Token.from(:equals, "="),
          value: value_node
        )
      end
    end
  end
end
