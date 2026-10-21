# frozen_string_literal: true

require_relative "test_helper"
require "yaml"

module RuboCop
  module Herb
    class PluginTest < Minitest::Spec
      test "registers the extractor once" do
        extractors = ::RuboCop::Runner.ruby_extractors
        extractors.delete(Plugin::EXTRACT_RUBY)
        context = LintRoller::Context.new(engine: :rubocop, engine_version: ::RuboCop::Version::STRING)

        2.times { Plugin.new.rules(context) }

        assert_equal Plugin::EXTRACT_RUBY, extractors.first
        assert_equal 1, extractors.count(Plugin::EXTRACT_RUBY)
      end

      test "includes exactly the template extensions the extractor handles" do
        assert_equal(TemplateSource::EXTENSIONS.map { |extension| "**/*#{extension}" }, config.dig("AllCops", "Include"))
      end

      test "excludes only cops that exist" do
        cops = config.keys.grep(%r{/}).reject { |name| name.start_with?("Rails/") }

        assert_empty(cops.reject { |name| ::RuboCop::Cop::Registry.global.find_by_cop_name(name) })
      end

      private

      def config
        YAML.load_file(File.expand_path("../config/default.yml", __dir__), aliases: true)
      end
    end
  end
end
