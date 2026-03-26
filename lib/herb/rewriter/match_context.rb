# frozen_string_literal: true
# typed: true
# rbs_inline: enabled

module Herb
  class Rewriter
    class MatchContext
      attr_reader :erb_node #: Herb::AST::Node
      attr_reader :prism_node #: Prism::CallNode
      attr_reader :method_name #: String
      attr_reader :body #: Array[Herb::AST::Node]

      #: (erb_node: Herb::AST::Node, prism_node: Prism::CallNode, method_name: String, ?body: Array[Herb::AST::Node]) -> void
      def initialize(erb_node:, prism_node:, method_name:, body: [])
        @erb_node = erb_node
        @prism_node = prism_node
        @method_name = method_name
        @body = body
      end

      #: () -> Array[Prism::Node]
      def arguments
        return [] unless prism_node.arguments

        prism_node.arguments.arguments
      end

      #: () -> String?
      def first_string_argument
        first = arguments.first
        return nil unless first

        case first
        when Prism::StringNode then first.unescaped
        when Prism::SymbolNode then first.unescaped
        end
      end

      EMPTY_KEYWORD_ARGUMENTS = {} #: Hash[String, Prism::Node]

      #: () -> Hash[String, Prism::Node]
      def keyword_arguments
        return EMPTY_KEYWORD_ARGUMENTS unless prism_node.arguments

        last_argument = prism_node.arguments.arguments.last
        return {} unless last_argument.is_a?(Prism::KeywordHashNode)

        last_argument.elements.each_with_object({}) do |element, hash|
          next unless element.is_a?(Prism::AssocNode)

          key = element.key
          key_name = case key
                     when Prism::SymbolNode then key.unescaped
                     when Prism::StringNode then key.unescaped
                     end

          hash[key_name] = element.value if key_name
        end
      end

      #: () -> bool
      def block?
        prism_node.block.is_a?(Prism::BlockNode)
      end
    end
  end
end
