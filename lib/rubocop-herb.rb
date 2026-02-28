# frozen_string_literal: true

require "rubocop"
require "herb"

require_relative "rubocop/herb"
require_relative "rubocop/herb/version"
require_relative "rubocop/herb/plugin"
require_relative "rubocop/cop/herb_cops"

RuboCop::ConfigLoader.inject_defaults!(RuboCop::Herb::Plugin::CONFIG_PATH)
