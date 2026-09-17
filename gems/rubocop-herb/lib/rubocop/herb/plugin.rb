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
        extractors = RuboCop::Runner.ruby_extractors
        extractors.unshift(RubyExtractor) unless extractors.include?(RubyExtractor)

        LintRoller::Rules.new(
          config_format: :rubocop,
          type: :path,
          value: Pathname.new(__dir__).join("../../../config/default.yml")
        )
      end

      def supported?(context)
        context.engine == :rubocop
      end
    end
  end
end
