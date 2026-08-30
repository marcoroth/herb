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

      #: (String) -> bool
      def self.heredoc?(code)
        code.match?(/<<[~-]?\s*['"`]?\w/)
      end

      #: (String) -> String
      def self.strip_trailing_comment(code)
        return code unless code.include?("#")
        return code unless prism_available?

        comment = Prism.parse(code).comments.find { |found| found.location.end_offset >= code.bytesize }

        return code unless comment

        code.byteslice(0, comment.location.start_offset).to_s.rstrip
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
