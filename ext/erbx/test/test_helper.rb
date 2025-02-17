# frozen_string_literal: true

$LOAD_PATH.unshift File.expand_path("../lib", __dir__)

require "erbx"
require "pathname"
require "maxitest/autorun"
require "minitest/spec"

require_relative "fork_helper" if ENV["UPDATE_SNAPSHOTS"].nil? && !ENV["NO_FORK"].nil?

require_relative "snapshot_utils"

Minitest::Spec::DSL.send(:alias_method, :test, :it)
Minitest::Spec::DSL.send(:alias_method, :xtest, :xit)
