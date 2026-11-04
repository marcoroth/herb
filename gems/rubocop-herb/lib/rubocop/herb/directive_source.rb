# frozen_string_literal: true

require "delegate"
require "prism"

module RuboCop
  module Herb
    # Keep directives separate from parsed Ruby so a comment cannot hide a later tag.
    class DirectiveSource < SimpleDelegator
      RUBY_OPENERS = ["<%", "<%=", "<%==", "<%-", "<%#"].freeze

      attr_reader :raw_source, :comments

      def initialize(source, original)
        super(source)
        @raw_source = original.raw_source
        @comments = source.comments.reject { |comment| comment.text.include?("rubocop:") }
        @comments.concat(directive_comments(original))
        @comments.sort_by! { |comment| comment.loc.expression.begin_pos }
      end

      private

      def directive_comments(original)
        opener = nil

        ::Herb.lex(raw_source).value.flat_map do |token|
          case token.type
          when "TOKEN_ERB_START"
            opener = token.value
            []
          when "TOKEN_ERB_CONTENT"
            next [] unless token.value.include?("rubocop:")

            comments_for(token, opener, original.buffer)
          else
            []
          end
        end
      end

      def comments_for(token, opener, buffer)
        return [] unless RUBY_OPENERS.include?(opener)

        comment_tag = opener == "<%#"
        content = comment_tag ? "##{token.value}" : token.value
        offset = token.range.from - (comment_tag ? 1 : 0)

        Prism.parse_comments(content).filter_map do |comment|
          next unless comment.location.slice.include?("rubocop:")

          comment_from_location(buffer, offset, comment.location)
        end
      end

      def comment_from_location(buffer, offset, location)
        first = raw_source.byteslice(0, offset + location.start_offset).length
        last = raw_source.byteslice(0, offset + location.end_offset).length
        ::Parser::Source::Comment.new(::Parser::Source::Range.new(buffer, first, last))
      end
    end
  end
end
