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
        return unless erb_file?
        return [] unless html_erb_file?

        template = @processed_source.raw_source
        ruby_ranges = RubyRangeCollector.call(template)
        return [] if ruby_ranges.empty?

        source = ProcessedSourceBuilder.call(
          code: ruby_source(template),
          processed_source: @processed_source,
          ruby_ranges:
        )
        return [] unless source.valid_syntax?

        [{ offset: 0, processed_source: source }]
      end

      private

      def erb_file?
        @processed_source.path&.end_with?(".erb")
      end

      def html_erb_file?
        @processed_source.path&.end_with?(".html.erb")
      end

      def ruby_source(template)
        extracted = ::Herb.extract_ruby(template)
        return extracted if extracted.length == template.length

        byte_offset = 0
        template.each_char.map do |character|
          extracted_character = extracted.byteslice(byte_offset, character.bytesize)
          byte_offset += character.bytesize

          extracted_character == character ? character : extracted_character.each_char.first
        end.join
      end
    end
  end
end
