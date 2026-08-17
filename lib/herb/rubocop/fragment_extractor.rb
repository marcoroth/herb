# frozen_string_literal: true
# typed: ignore

module Herb
  module Rubocop
    class FragmentExtractor
      SKIPPED_OPENINGS = ["<%#", "<%graphql"].freeze

      def self.extract(source)
        new(source).extract
      end

      def initialize(source)
        @tokens = Herb.lex(source).value
      end

      def extract
        opening = nil

        @tokens.filter_map do |token|
          case token.type
          when "TOKEN_ERB_START"
            opening = token
            nil
          when "TOKEN_ERB_CONTENT"
            fragment_for(token, opening)
          when "TOKEN_ERB_END"
            opening = nil
            nil
          end
        end
      end

      private

      def fragment_for(token, opening)
        return unless opening
        return if SKIPPED_OPENINGS.include?(opening.value) || opening.value.start_with?("<%%")

        Fragment.new(
          content: token.value,
          range: token.range,
          column: token.location.start.column
        )
      end
    end
  end
end
