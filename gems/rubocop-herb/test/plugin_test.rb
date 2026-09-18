# frozen_string_literal: true

require_relative "test_helper"
require "yaml"

module RuboCop
  module Herb
    class PluginTest < Minitest::Spec
      test "registers the extractor only once" do
        extractors = ::RuboCop::Runner.ruby_extractors
        extractors.delete(RubyExtractor)
        plugin = Plugin.new
        context = LintRoller::Context.new(engine: :rubocop, engine_version: "1.84.0")

        2.times { plugin.rules(context) }

        assert_equal 1, extractors.count(RubyExtractor)
      ensure
        extractors&.delete(RubyExtractor)
      end

      test "excludes cops that misinterpret HTML conditional bodies" do
        config = YAML.load_file(File.expand_path("../config/default.yml", __dir__))

        assert_equal ["**/*.html.erb"], config.dig("Lint/EmptyConditionalBody", "Exclude")
        assert_equal ["**/*.html.erb"], config.dig("Rails/Presence", "Exclude")
      end
    end
  end
end
