# frozen_string_literal: true
# typed: true

module Herb
  class Engine
    module Helpers
      #: (String) -> bool
      def self.comment?(code)
        stripped = code.rstrip

        return false unless stripped.include?("#")
        return true unless prism_available?

        Prism.parse(stripped).comments.any? { |comment| comment.location.end_offset >= stripped.bytesize }
      rescue StandardError
        true
      end

      #: (String) -> String
      def self.without_trailing_spaces(code)
        code.sub(/[ \t]+\z/, "")
      end

      #: (String) -> bool
      def self.ends_on_heredoc_terminator?(code)
        return false unless code.include?("<<")

        tokens = heredoc_tokens(code)

        return true unless tokens

        tokens.any? { |token| token.type == :HEREDOC_END && token.location.start_line == code.lines.size }
      end

      #: (String) -> bool
      def self.heredoc?(code)
        return false unless code.include?("<<")

        tokens = heredoc_tokens(code)

        return true unless tokens

        tokens.any? { |token| token.type == :HEREDOC_START }
      end

      #: (String) -> Array[untyped]?
      def self.heredoc_tokens(code)
        return nil unless prism_available?

        Prism.lex(code).value.map(&:first)
      rescue StandardError
        nil
      end

      #: (String) -> String
      def self.strip_trailing_comment(code)
        return code unless code.include?("#")
        return code unless prism_available?

        comment = Prism.parse(code).comments.find { |found| found.location.end_offset >= code.bytesize }

        return code unless comment

        without_trailing_spaces(code.byteslice(0, comment.location.start_offset).to_s)
      rescue StandardError
        code
      end

      #: () -> bool
      def self.prism_available?
        return @prism_available unless @prism_available.nil?

        @prism_available = begin
          require "prism"
          true
        rescue LoadError
          false
        end
      end
    end
  end
end
