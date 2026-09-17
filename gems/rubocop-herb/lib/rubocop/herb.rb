# frozen_string_literal: true

require "rubocop"

module RuboCop
  module Herb
    autoload :KeywordRemover, "rubocop/herb/keyword_remover"
    autoload :ProcessedSourceBuilder, "rubocop/herb/processed_source_builder"
    autoload :RubyClip, "rubocop/herb/ruby_clip"
    autoload :RubyExtractor, "rubocop/herb/ruby_extractor"
    autoload :WhenDecomposer, "rubocop/herb/when_decomposer"
  end
end

require_relative "herb/plugin"
require_relative "herb/version"
