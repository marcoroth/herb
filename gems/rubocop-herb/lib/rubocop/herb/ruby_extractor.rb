# frozen_string_literal: true

require "herb"
require "rubocop"

module RuboCop
  module Herb
    class RubyExtractor
      def self.call(processed_source)
        new(processed_source).call
      end

      def initialize(processed_source)
        @processed_source = processed_source
      end

      def call
        return unless supported_file?

        ruby_source = RubySourceBuilder.call(@processed_source.raw_source)
        return [] if ruby_source.ranges.empty?

        source = ProcessedSourceBuilder.call(
          code: ruby_source.code,
          processed_source: @processed_source,
          ruby_ranges: ruby_source.ranges
        )
        return [] unless source.valid_syntax?

        [{ offset: 0, processed_source: source }]
      end

      private

      def supported_file?
        @processed_source.path&.end_with?(".erb")
      end
    end
  end
end
