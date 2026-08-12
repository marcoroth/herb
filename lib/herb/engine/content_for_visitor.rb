# frozen_string_literal: true
# typed: false

require_relative "../../herb"

module Herb
  class Engine
    # Appends HTML to the end of every element matching a tag name, and optionally a set of
    # attribute conditions, so that the compiled output always contains it before the
    # element's closing tag.
    #
    # An attribute condition matches on `true` when the attribute is present, on `false` when
    # it is absent, on a `Regexp` when the attribute value matches it, and on anything else
    # when the attribute value is equal to it. An attribute whose value is built from ERB has
    # no value known at compile time, so it only matches the `true` condition.
    #
    # This visitor is not loaded by default. Require it explicitly and pass it to the engine:
    #
    #     require "herb/engine/content_for_visitor"
    #
    #     Herb::Engine.new(source, visitors: [
    #       Herb::Engine::ContentForVisitor.new("<p>Footer</p>", tag_name: "main", attributes: { "id" => "content" })
    #     ])
    #
    class ContentForVisitor < Herb::Visitor
      #: (String?, tag_name: String, ?attributes: Hash[untyped, untyped]) -> void
      def initialize(content, tag_name:, attributes: {})
        super()

        @content = content
        @tag_name = tag_name.downcase
        @attributes = attributes.transform_keys { |name| name.to_s.downcase }
      end

      #: (Herb::AST::HTMLElementNode) -> void
      def visit_html_element_node(node)
        super

        return if @content.nil? || @content.empty?
        return unless matches?(node)

        node.body << content_node
      end

      #: () -> String
      def inspect
        "#<#{self.class.name} tag_name=#{@tag_name.inspect} attributes=#{@attributes.inspect} content=#{@content.inspect}>"
      end

      private

      #: () -> Herb::AST::RubyLiteralNode
      def content_node
        Herb::AST::RubyLiteralNode.build(content: "#{@content.dump}.html_safe")
      end

      #: (Herb::AST::HTMLElementNode) -> bool
      def matches?(node)
        return false unless node.tag_name&.value&.downcase == @tag_name
        return true if @attributes.empty?

        attributes = element_attributes(node)

        @attributes.all? { |name, condition| attribute_matches?(attributes, name, condition) }
      end

      #: (Hash[String, String?], String, untyped) -> bool
      def attribute_matches?(attributes, name, condition)
        present = attributes.key?(name)
        value = attributes[name]

        case condition
        when true then present
        when false then !present
        when Regexp then !value.nil? && condition.match?(value)
        else !value.nil? && condition.to_s == value
        end
      end

      #: (Herb::AST::HTMLElementNode) -> Hash[String, String?]
      def element_attributes(node)
        open_tag = node.open_tag
        attributes = {} #: Hash[String, String?]

        return attributes unless open_tag.is_a?(Herb::AST::HTMLOpenTagNode)

        (open_tag.children || []).each do |child|
          next unless child.is_a?(Herb::AST::HTMLAttributeNode)

          name = attribute_name(child)

          next unless name
          next if attributes.key?(name)

          attributes[name] = attribute_value(child)
        end

        attributes
      end

      #: (Herb::AST::HTMLAttributeNode) -> String?
      def attribute_name(node)
        children = node.name&.children

        return nil unless children

        name = children.filter_map { |child| child.content if child.is_a?(Herb::AST::LiteralNode) }.join

        name.empty? ? nil : name.downcase
      end

      #: (Herb::AST::HTMLAttributeNode) -> String?
      def attribute_value(node)
        value = node.value

        return nil unless value

        children = value.children || []

        return "" if children.empty?
        return nil unless children.all?(Herb::AST::LiteralNode)

        children.filter_map { |child| child.content if child.is_a?(Herb::AST::LiteralNode) }.join
      end
    end
  end
end
