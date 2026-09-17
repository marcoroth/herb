# frozen_string_literal: true

require "prism"

module RuboCop
  module Herb
    class KeywordRemover
      PRECEDING_KEYWORDS = [
        :KEYWORD_BEGIN,
        :KEYWORD_CASE,
        :KEYWORD_ELSE,
        :KEYWORD_ELSIF,
        :KEYWORD_END,
        :KEYWORD_ENSURE,
        :KEYWORD_IF,
        :KEYWORD_RESCUE,
        :KEYWORD_UNLESS,
        :KEYWORD_UNTIL,
        :KEYWORD_WHEN,
        :KEYWORD_WHILE
      ].freeze
      TRAILING_KEYWORDS = [:KEYWORD_DO, :BRACE_LEFT, :KEYWORD_THEN].freeze
      TRIVIA = [:COMMENT, :EOF, :IGNORED_NEWLINE, :NEWLINE].freeze

      def self.call(ruby_clip)
        new(ruby_clip).call
      end

      def initialize(ruby_clip)
        @ruby_clip = ruby_clip
      end

      def call
        remove_trailing_source(remove_preceding_source(@ruby_clip))
      end

      private

      def remove_preceding_source(clip)
        tokens = significant_tokens(clip.code)
        first = tokens.first
        return clip unless preceding_token?(first)

        next_token = token_after_preceding_keyword(tokens)
        removed_bytes = next_token&.location&.start_offset || clip.code.bytesize
        RubyClip.new(
          code: clip.code.byteslice(removed_bytes..),
          offset: clip.offset + removed_bytes
        )
      end

      def preceding_token?(token)
        return false unless token

        PRECEDING_KEYWORDS.include?(token.type) ||
          token.type == :BRACE_RIGHT ||
          token.type == :KEYWORD_FOR
      end

      def token_after_preceding_keyword(tokens)
        return tokens[1] unless tokens.first.type == :KEYWORD_FOR

        in_index = tokens.index { |token| token.type == :KEYWORD_IN }
        in_index ? tokens[in_index + 1] : nil
      end

      def remove_trailing_source(clip)
        tokens = significant_tokens(clip.code)
        trailing_index = tokens.rindex { |token| TRAILING_KEYWORDS.include?(token.type) }
        return clip unless trailing_index
        return clip unless removable_suffix?(tokens, trailing_index)

        RubyClip.new(
          code: clip.code.byteslice(0...tokens[trailing_index].location.start_offset).rstrip,
          offset: clip.offset
        )
      end

      def removable_suffix?(tokens, trailing_index)
        trailing_token = tokens[trailing_index]
        suffix = tokens[(trailing_index + 1)..]
        return suffix.empty? if trailing_token.type == :KEYWORD_THEN
        return true if suffix.empty?

        suffix.first.type == :PIPE && suffix.last.type == :PIPE
      end

      def significant_tokens(source)
        Prism.lex(source).value.filter_map do |token, _state|
          token unless TRIVIA.include?(token.type)
        end
      end
    end
  end
end
