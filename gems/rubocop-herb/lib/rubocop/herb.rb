# frozen_string_literal: true

require "herb"
require "rubocop"

module RuboCop
  module Herb
    autoload :ProcessedSourceBuilder, "rubocop/herb/processed_source_builder"
  end
end

require_relative "herb/plugin"
require_relative "herb/version"
