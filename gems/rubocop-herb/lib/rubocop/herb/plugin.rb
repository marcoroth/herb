# frozen_string_literal: true

require "lint_roller"

module RuboCop
  module Herb
    class Plugin < LintRoller::Plugin
      def about
        LintRoller::About.new(
          description: "Run configured RuboCop rules against Ruby in ERB templates.",
          homepage: "https://github.com/marcoroth/herb",
          name: "rubocop-herb",
          version: ::Herb::VERSION
        )
      end

      def rules(_context)
        extractors = RuboCop::Runner.ruby_extractors
        extractors.unshift(EXTRACT_RUBY) unless extractors.include?(EXTRACT_RUBY)

        LintRoller::Rules.new(
          config_format: :rubocop,
          type: :path,
          value: File.expand_path("../../../config/default.yml", __dir__)
        )
      end

      def supported?(context)
        context.engine == :rubocop
      end

      def self.extract_ruby(processed_source)
        return unless TemplateSource.template?(processed_source.path)

        source = TemplateSource.from(processed_source)
        return [] if source.valid_syntax? && !source.ast

        [{ offset: 0, processed_source: source }]
      end

      EXTRACT_RUBY = method(:extract_ruby)
    end
  end
end
