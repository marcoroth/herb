# frozen_string_literal: true
# typed: ignore

module Herb
  module Rubocop
    class Result
      attr_reader :filename, :offenses

      def initialize(filename:, offenses:)
        @filename = filename
        @offenses = offenses
      end

      def success?
        offenses.empty?
      end

      def to_hash
        {
          filename: filename,
          offenses: offenses.map(&:to_hash),
        }
      end
    end
  end
end
