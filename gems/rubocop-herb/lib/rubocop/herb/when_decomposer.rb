# frozen_string_literal: true

module RuboCop
  module Herb
    class WhenDecomposer
      WHEN = /\A\s*when[ \t]/x

      def self.call(processed_source, ruby_clip)
        new(processed_source, ruby_clip).call
      end

      def initialize(processed_source, ruby_clip)
        @processed_source = processed_source
        @ruby_clip = ruby_clip
      end

      def call
        match = @ruby_clip.code.match(WHEN)
        return [@ruby_clip] unless match

        parse_conditions(match).map { |child| clip_for(child, match) }
      end

      private

      def parse_conditions(match)
        condition = @ruby_clip.code.byteslice(match[0].bytesize..)
        condition = condition.sub(/[ \t]then(?:[ \t].*)?/, "")
        parse("[\n#{condition}\n]")&.children || []
      end

      def clip_for(child, match)
        expression = child.location.expression
        RubyClip.new(
          code: expression.source,
          offset: @ruby_clip.offset + match[0].bytesize + expression.begin_pos - 2
        )
      end

      def parse(source)
        ProcessedSourceBuilder.call(code: source, processed_source: @processed_source).ast
      end
    end
  end
end
