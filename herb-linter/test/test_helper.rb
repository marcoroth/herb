# frozen_string_literal: true

$LOAD_PATH.unshift File.expand_path("../lib", __dir__)

require "herb-linter"
require "maxitest/autorun"
require "minitest/spec"

Minitest::Spec::DSL.send(:alias_method, :test, :it)
Minitest::Spec::DSL.send(:alias_method, :xtest, :xit)
