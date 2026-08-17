# frozen_string_literal: true
# typed: ignore

module Herb
  module Rubocop
    Fragment = Data.define(:content, :range, :column) do
      def ruby_source
        content
          .sub(/\s*((\s+|\))do|\{)(\s*\|[^|]*\|)?\s*\z/, "")
          .sub(/[[:blank:]]*\z/, "")
      end

      def aligned_source
        (" " * column) + ruby_source
      end

      def offset
        range.from - column
      end

      def contains?(begin_pos, end_pos)
        range.from <= begin_pos && end_pos <= range.to
      end
    end
  end
end
