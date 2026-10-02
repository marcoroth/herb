# frozen_string_literal: true

require_relative "test_helper"
require "yaml"

module RuboCop
  module Herb
    class PluginTest < Minitest::Spec
      test "registers the extractor" do
        extractors = ::RuboCop::Runner.ruby_extractors
        extractor = Plugin::EXTRACT_RUBY
        extractors.delete(extractor)
        plugin = Plugin.new
        context = LintRoller::Context.new(engine: :rubocop, engine_version: "1.84.0")

        plugin.rules(context)

        assert_equal extractor, extractors.first
      ensure
        extractors&.delete(extractor)
      end

      test "excludes cops that misinterpret HTML conditional bodies" do
        config = YAML.load_file(File.expand_path("../config/default.yml", __dir__), aliases: true)
        template_files = ["**/*.erb", "**/*.herb"]

        assert_equal template_files, config.dig("Lint/EmptyConditionalBody", "Exclude")
        assert_equal template_files, config.dig("Rails/Presence", "Exclude")
      end
    end
  end
end
