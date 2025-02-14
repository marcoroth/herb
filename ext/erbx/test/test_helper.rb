# frozen_string_literal: true

$LOAD_PATH.unshift File.expand_path("../lib", __dir__)

require "erbx"
require "maxitest/autorun"
require "minitest/spec"

require_relative "fork_helper" unless ENV["NO_FORK"]

Minitest::Spec::DSL.send(:alias_method, :test, :it)
Minitest::Spec::DSL.send(:alias_method, :xtest, :xit)
