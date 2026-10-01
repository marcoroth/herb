# frozen_string_literal: true

module RuboCop
  module Herb
    module RangeRestrictedAutocorrect
      private

      def autocorrect_report(report, offset:, original:)
        ranges = herb_ruby_ranges(report)
        return super unless ranges

        corrector = collate_corrections(report, offset:, original:)
        restricted = RuboCop::Cop::Corrector.new(original)

        corrector.as_replacements.each do |range, replacement|
          restricted.replace(range, replacement) if herb_correction_allowed?(range, ranges)
        end

        restricted.rewrite unless restricted.empty?
      end

      def herb_ruby_ranges(report)
        source = report.processed_source
        source.herb_ruby_ranges if source.respond_to?(:herb_ruby_ranges)
      end

      def herb_correction_allowed?(correction, ranges)
        ranges.any? do |range|
          range.from <= correction.begin_pos && correction.end_pos <= range.to
        end
      end
    end
  end
end
