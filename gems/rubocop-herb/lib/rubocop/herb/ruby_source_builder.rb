# frozen_string_literal: true

module RuboCop
  module Herb
    RubySource = Data.define(:code, :ranges)

    class RubySourceBuilder
      STATEMENT_SEPARATOR = ";".ord

      def self.call(template)
        new(template).call
      end

      def initialize(template)
        @template = template
      end

      def call
        ranges = ruby_ranges
        source = masked_template
        ranges.each_with_index do |range, index|
          copy_ruby(source, range)
          add_separator(source, range, ranges[index + 1])
        end

        RubySource.new(code: source.join, ranges:)
      end

      private

      def masked_template
        template_characters.map { |character| character == "\n" ? character : " " }
      end

      def copy_ruby(source, range)
        source[range.from...range.to] = template_characters[range.from...range.to]
      end

      def add_separator(source, range, next_range)
        return unless next_range
        return if template_characters[range.to...next_range.from].include?("\n")

        source[range.to] = STATEMENT_SEPARATOR.chr
      end

      def ruby_ranges
        visitor = ErbNodeVisitor.new
        visitor.visit(::Herb.parse(@template).value)
        visitor.ranges.map { |range| character_range(range) }
      end

      def character_range(byte_range)
        ::Herb::Range.new(
          @template.byteslice(0, byte_range.from).length,
          @template.byteslice(0, byte_range.to).length
        )
      end

      def template_characters
        @template_characters ||= @template.each_char.to_a
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
