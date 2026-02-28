# frozen_string_literal: true

require "lint_roller"

module RuboCop
  module Herb
    class Plugin < LintRoller::Plugin
      CONFIG_PATH = File.expand_path("default.yml", __dir__).freeze

      def about
        LintRoller::About.new(
          name: "rubocop-herb",
          version: VERSION,
          homepage: "https://herb-tools.dev",
          description: "RuboCop integration for the Herb Linter"
        )
      end

      def supported?(context)
        context.engine == :rubocop
      end

      def rules(context)
        LintRoller::Rules.new(
          type: :path,
          config_format: :rubocop,
          value: config_path
        )
      end

      private

      def config_path
        CONFIG_PATH
      end
    end
  end
end
