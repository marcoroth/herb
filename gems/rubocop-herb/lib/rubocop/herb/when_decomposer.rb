# frozen_string_literal: true

require "prism"

module RuboCop
  module Herb
    class WhenDecomposer
      TRIVIA = [:COMMENT, :EOF, :IGNORED_NEWLINE, :NEWLINE].freeze

      def self.call(ruby_clip)
        new(ruby_clip).call
      end

      def initialize(ruby_clip)
        @ruby_clip = ruby_clip
      end

      def call
        tokens = significant_tokens
        return [@ruby_clip] unless tokens.first&.type == :KEYWORD_WHEN

        start_offset = condition_start(tokens)
        clips_for(start_offset, condition_end(tokens))
      end

      private

      def significant_tokens
        Prism.lex(@ruby_clip.code).value.filter_map do |token, _state|
          token unless TRIVIA.include?(token.type)
        end
      end

      def trailing_then(tokens)
        token = tokens.last
        token if token&.type == :KEYWORD_THEN
      end

      def condition_start(tokens)
        tokens[1]&.location&.start_offset || @ruby_clip.code.bytesize
      end

      def condition_end(tokens)
        trailing_then(tokens)&.location&.start_offset || @ruby_clip.code.bytesize
      end

      def clips_for(start_offset, end_offset)
        parse_conditions(start_offset, end_offset).map { |child| clip_for(child, start_offset) }
      end

      def parse_conditions(condition_start, condition_end)
        condition = @ruby_clip.code.byteslice(condition_start...condition_end)
        result = Prism.parse("[\n#{condition}\n]")
        return [] unless result.success?

        result.value.statements.body.first.elements
      end

      def clip_for(child, condition_start)
        RubyClip.new(
          code: child.location.slice,
          offset: @ruby_clip.offset + condition_start + child.location.start_offset - 2
        )
      end
    end
  end
end
