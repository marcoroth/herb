# frozen_string_literal: true

$LOAD_PATH.unshift File.expand_path("../lib", __dir__)

require "herb"
require "pathname"
require "maxitest/autorun"
require "minitest/spec"

require "active_support/core_ext/string/output_safety"

if ENV["FORK_TESTS"]
  require_relative "fork_helper"
else
  puts "TIP: If a segfault in the native C extension crashes the test runner, run with FORK_TESTS=true to isolate each test in a forked process and identify which test causes the crash."
end
require_relative "snapshot_utils"

Minitest::Spec::DSL.send(:alias_method, :test, :it)
Minitest::Spec::DSL.send(:alias_method, :xtest, :xit)

def cyclic_string(length)
  sequence = ("a".."z").to_a + ("0".."9").to_a
  sequence.cycle.take(length).join
end

module Analyze
  module ActionView
  end
end
