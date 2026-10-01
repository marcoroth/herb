# frozen_string_literal: true

module RuboCop
  module Herb
    module RangeRestrictedCorrector
      def replace(node_or_range, content)
        return unless herb_range_allowed?(node_or_range)

        super
      end

      def wrap(node_or_range, insert_before, insert_after)
        return unless herb_range_allowed?(node_or_range)

        super
      end

      private

      def herb_range_allowed?(node_or_range)
        ranges = source_buffer.herb_ruby_ranges if source_buffer.respond_to?(:herb_ruby_ranges)
        return true unless ranges

        correction = to_range(node_or_range)
        ranges.any? do |range|
          range.from <= correction.begin_pos && correction.end_pos <= range.to
        end
      end
    end
  end
end
