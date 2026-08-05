# frozen_string_literal: true

require_relative "../../herb"
require_relative "component_visitor/component_resolver"
require_relative "component_visitor/partial_resolver"

module Herb
  class Engine
    class ComponentVisitor < Herb::Visitor
      TAG_NAME_SEPARATOR = /::|\./
      KEYWORD_NAME = /\A[a-z_][A-Za-z0-9_]*\z/

      ARRAY_PROPERTIES = [:children, :body, :statements].freeze
      NODE_PROPERTIES = [:subsequent, :else_clause, :end_node, :rescue_clause, :ensure_clause].freeze

      # @rbs!
      #   def self.experimental_warning_issued: () -> bool
      #   def self.experimental_warning_issued=: (bool) -> bool

      class << self
        attr_accessor :experimental_warning_issued #: bool
      end

      self.experimental_warning_issued = false

      #: (?resolvers: Array[Herb::Engine::ComponentVisitor::Resolver]) -> void
      def initialize(resolvers: [ComponentResolver.new, PartialResolver.new])
        super()

        @resolvers = resolvers

        return if self.class.experimental_warning_issued

        self.class.experimental_warning_issued = true

        warn "[Herb] The Component-Transform Visitor is experimental. Its output and API may change."
      end

      def visit_document_node(node)
        super
        replace_component_nodes_recursive(node)
      end

      #: () -> String
      def inspect
        "#<#{self.class.name}>"
      end

      private

      def replace_component_nodes_recursive(node)
        ARRAY_PROPERTIES.each do |property|
          next unless node.respond_to?(property) && node.send(property).is_a?(Array)

          array = node.send(property)

          array.each_with_index do |child, index|
            if component?(child)
              array[index] = transform_to_erb_component(child)
            else
              replace_component_nodes_recursive(child)
            end
          end
        end

        NODE_PROPERTIES.each do |property|
          next unless node.respond_to?(property) && node.send(property)

          replace_component_nodes_recursive(node.send(property))
        end
      end

      #: (Herb::AST::Node?) -> bool
      def component?(node)
        return false unless node.is_a?(Herb::AST::HTMLElementNode)

        tag_name = node.tag_name&.value

        return false unless tag_name
        return false unless resolver_for(tag_name)

        tag_name.split(TAG_NAME_SEPARATOR).all? { |segment| segment.match?(/[a-z]/) }
      end

      def transform_to_erb_component(element_node)
        tag_name = element_node.tag_name&.value
        attributes = extract_attributes_from_element(element_node)
        body = element_node.body || []

        body.each do |child|
          replace_component_nodes_recursive(child)
        end

        body.each_with_index do |child, index|
          body[index] = transform_to_erb_component(child) if component?(child)
        end

        if body.empty?
          erb_content_node(element_node, "#{render_code(tag_name, attributes, block: false)} ")
        else
          erb_block_node(element_node, "#{render_code(tag_name, attributes, block: true)} do ", body)
        end
      end

      #: (String) -> Herb::Engine::ComponentVisitor::Resolver?
      def resolver_for(tag_name)
        @resolvers.find { |resolver| resolver.handles?(tag_name) }
      end

      #: (String?, Hash[String, String], block: bool) -> String?
      def render_code(tag_name, attributes, block:)
        return nil unless tag_name

        resolver_for(tag_name)&.render_code(tag_name, attributes, block: block)
      end

      #: (Herb::AST::HTMLElementNode) -> Hash[String, String]
      def extract_attributes_from_element(element_node)
        open_tag = element_node.open_tag
        attributes = {} #: Hash[String, String]

        return attributes unless open_tag.is_a?(Herb::AST::HTMLOpenTagNode)

        children = open_tag.children

        return attributes unless children

        children.each do |child|
          next unless child.is_a?(Herb::AST::HTMLAttributeNode)

          original_name = attribute_name(child)

          next unless original_name

          directive = original_name.start_with?(":")
          name = original_name.delete_prefix(":").tr("-", "_")

          next unless name.match?(KEYWORD_NAME)
          next if attributes.key?(name)

          attributes[name] = attribute_value(child, directive: directive)
        end

        attributes
      end

      #: (Herb::AST::HTMLAttributeNode) -> String?
      def attribute_name(node)
        children = node.name&.children

        return nil unless children

        name = children.filter_map { |child| child.content if child.is_a?(Herb::AST::LiteralNode) }.join

        name.empty? ? nil : name
      end

      #: (Herb::AST::HTMLAttributeNode, directive: bool) -> String
      def attribute_value(node, directive:)
        value = node.value

        return "true" unless value

        children = value.children || []

        return directive ? "nil" : '""' if children.empty?
        return ruby_code_from(children) if directive

        string_literal_from(children)
      end

      #: (Array[Herb::AST::Node]) -> String
      def ruby_code_from(children)
        children.filter_map { |child|
          case child
          when Herb::AST::LiteralNode then child.content
          when Herb::AST::ERBContentNode then child.content&.value&.strip
          end
        }.join.strip
      end

      #: (Array[Herb::AST::Node]) -> String
      def string_literal_from(children)
        parts = children.filter_map { |child|
          case child
          when Herb::AST::LiteralNode
            escape(child.content.to_s)
          when Herb::AST::ERBContentNode
            code = child.content&.value&.strip

            "\#{#{code}}" if code
          end
        }

        %("#{parts.join}")
      end

      #: (String) -> String
      def escape(content)
        dumped = content.dump

        dumped[1...-1].to_s
      end

      #: (Herb::AST::HTMLElementNode, String) -> Herb::AST::ERBContentNode
      def erb_content_node(element_node, code)
        # steep:ignore:start
        Herb::AST::ERBContentNode.new(
          "ERBContentNode",
          element_node.location,
          [],
          Herb::Token.from("TOKEN_ERB_START", "<%="),
          Herb::Token.from("TOKEN_ERB_CONTENT", " #{code}"),
          Herb::Token.from("TOKEN_ERB_END", "%>"),
          nil,
          false,
          true,
          nil
        )
        # steep:ignore:end
      end

      #: (Herb::AST::HTMLElementNode, String, Array[Herb::AST::Node]) -> Herb::AST::ERBBlockNode
      def erb_block_node(element_node, code, body)
        # steep:ignore:start
        Herb::AST::ERBBlockNode.new(
          "ERBBlockNode",
          element_node.location,
          [],
          Herb::Token.from("TOKEN_ERB_START", "<%="),
          Herb::Token.from("TOKEN_ERB_CONTENT", " #{code}"),
          Herb::Token.from("TOKEN_ERB_END", "%>"),
          nil,
          body,
          [],
          nil,
          nil,
          nil,
          erb_end_node(element_node)
        )
        # steep:ignore:end
      end

      #: (Herb::AST::HTMLElementNode) -> Herb::AST::ERBEndNode
      def erb_end_node(element_node)
        Herb::AST::ERBEndNode.new(
          "ERBEndNode",
          element_node.location,
          [],
          Herb::Token.from("TOKEN_ERB_START", "<%"),
          Herb::Token.from("TOKEN_ERB_CONTENT", " end "),
          Herb::Token.from("TOKEN_ERB_END", "%>")
        )
      end
    end
  end
end
