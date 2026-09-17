# frozen_string_literal: true

require "rubocop"

module RuboCop
  module Herb
    autoload :ProcessedSourceBuilder, "rubocop/herb/processed_source_builder"
    autoload :RangeRestrictedAutocorrect, "rubocop/herb/range_restricted_autocorrect"
    autoload :RangeRestrictedCorrector, "rubocop/herb/range_restricted_corrector"
    autoload :RubyExtractor, "rubocop/herb/ruby_extractor"
    autoload :RubySourceBuilder, "rubocop/herb/ruby_source_builder"
  end
end

require_relative "herb/plugin"
require_relative "herb/version"
