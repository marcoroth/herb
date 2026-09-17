# frozen_string_literal: true

module RuboCop
  module Herb
    class KeywordRemover
      PRECEDING_KEYWORD = /
        \A
        \s*
        (?:
          begin
          | case
          | else
          | elsif
          | end
          | ensure
          | if
          | rescue
          | unless
          | until
          | when
          | while
          | for[ \t]+\w+[ \t]+in
        )
        \b[ \t]*
      /x
      PRECEDING_BRACE = /\A\s*}/
      TRAILING_BRACE = /{[ \t]*(?:\|[^|]*\|)?\s*\z/x
      TRAILING_THEN = /[ \t]*\bthen\s*\z/x
      TRAILING_DO = /(?:\b[ \t]*|[ \t])do[ \t]*(?:\|[^|]*\|)?\s*(?:\#.*)?\z/x

      def self.call(ruby_clip)
        new(ruby_clip).call
      end

      def initialize(ruby_clip)
        @ruby_clip = ruby_clip
      end

      def call
        code = @ruby_clip.code
        offset = @ruby_clip.offset

        [PRECEDING_KEYWORD, PRECEDING_BRACE].each do |pattern|
          match = code.match(pattern)
          next unless match

          code = code.byteslice(match[0].bytesize..)
          offset += match[0].bytesize
        end

        [TRAILING_BRACE, TRAILING_THEN, TRAILING_DO].each do |pattern|
          code = code.sub(pattern, "")
        end

        RubyClip.new(code:, offset:)
      end
    end
  end
end
