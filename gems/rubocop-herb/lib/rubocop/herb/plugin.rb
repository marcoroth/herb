# frozen_string_literal: true

require "lint_roller"
require "pathname"

module RuboCop
  module Herb
    class Plugin < LintRoller::Plugin
      def about
        LintRoller::About.new(
          description: "Run configured RuboCop rules against Ruby in ERB templates.",
          homepage: "https://github.com/marcoroth/herb",
          name: "rubocop-herb",
          version: VERSION
        )
      end

      def rules(_context)
        RuboCop::Runner.ruby_extractors.unshift(EXTRACT_RUBY)

        LintRoller::Rules.new(
          config_format: :rubocop,
          type: :path,
          value: Pathname.new(__dir__).join("../../../config/default.yml")
        )
      end

      def supported?(context)
        context.engine == :rubocop
      end

      def self.extract_ruby(processed_source)
        path = processed_source.path
        return unless path&.end_with?(".erb", ".herb")

        template = processed_source.raw_source
        code = position_preserving_ruby(template)
        return [] if code.strip.empty?

        source = ProcessedSourceBuilder.call(code:, processed_source:)
        return [] unless source.valid_syntax? && source.ast

        [{ offset: 0, processed_source: source }]
      end

      def self.position_preserving_ruby(template)
        extracted = ::Herb.extract_ruby(template)
        return extracted if extracted.length == template.length

        byte_offset = 0
        template.each_char.map do |character|
          extracted_character = extracted.byteslice(byte_offset, character.bytesize)
          byte_offset += character.bytesize

          extracted_character == character ? character : extracted_character.each_char.first
        end.join
      end

      private_class_method :position_preserving_ruby

      EXTRACT_RUBY = method(:extract_ruby).to_proc
    end
  end
end
