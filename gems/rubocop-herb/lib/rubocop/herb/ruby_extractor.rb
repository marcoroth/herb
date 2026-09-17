# frozen_string_literal: true

require "herb"
require "rubocop"

module RuboCop
  module Herb
    class RubyExtractor
      def self.call(processed_source)
        new(processed_source).call
      end

      def initialize(processed_source)
        @processed_source = processed_source
      end

      def call
        return unless supported_file?

        ruby_clips.filter_map do |ruby_clip|
          source = ProcessedSourceBuilder.call(
            code: ruby_clip.code,
            processed_source: @processed_source
          )
          next unless source.valid_syntax?

          { offset: ruby_clip.offset, processed_source: source }
        end
      end

      private

      def supported_file?
        @processed_source.path&.end_with?(".erb")
      end

      def ruby_clips
        clips = nodes.flat_map { |node| clips_for(node) }
        clips.map { |clip| KeywordRemover.call(clip) }.reject { |clip| blank?(clip) }
      end

      def clips_for(node)
        start = node.content.location.start
        line_range = @processed_source.buffer.line_range(start.line)
        clip = RubyClip.new(
          code: node.content.value,
          offset: line_range.begin.begin_pos + start.column
        )

        WhenDecomposer.call(clip)
      end

      def blank?(clip)
        clip.code.strip.empty?
      end

      def nodes
        visitor = ErbNodeVisitor.new
        visitor.visit(::Herb.parse(@processed_source.raw_source).value)
        visitor.nodes
      end

      class ErbNodeVisitor < ::Herb::Visitor
        attr_reader :nodes

        def initialize
          super
          @nodes = []
        end

        def visit_erb_node(node)
          @nodes << node if inspectable?(node)
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
