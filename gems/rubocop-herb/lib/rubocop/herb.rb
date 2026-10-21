# frozen_string_literal: true

require "herb"
require "rubocop"

require_relative "herb/template_source"
require_relative "herb/offense_guard"
require_relative "herb/plugin"

RuboCop::Cop::Base.prepend(RuboCop::Herb::OffenseGuard)
