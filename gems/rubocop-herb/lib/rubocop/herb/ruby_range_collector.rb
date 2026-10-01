# frozen_string_literal: true

module RuboCop
  module Herb
    class RubyRangeCollector
      def self.call(template)
        new(template).call
      end

      def initialize(template)
        @template = template
      end

      def call
        visitor = ErbNodeVisitor.new
        visitor.visit(::Herb.parse(@template).value)
        visitor.ranges.map { |range| character_range(range) }
      end

      private

      def character_range(byte_range)
        ::Herb::Range.new(
          @template.byteslice(0, byte_range.from).length,
          @template.byteslice(0, byte_range.to).length
        )
      end

      class ErbNodeVisitor < ::Herb::Visitor
        attr_reader :ranges

        def initialize
          super
          @ranges = []
        end

        def visit_erb_node(node)
          @ranges << node.content.range if inspectable?(node)
        end

        private

        def inspectable?(node)
          return false unless node.respond_to?(:content) && node.content

          opening = node.tag_opening&.value
          opening && opening != "<%#" && opening != "<%%" && opening != "<%graphql"
        end
      end
    end
  end
end
