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

require "herb/cli"
require "herb/engine"
require "herb/engine/validators"
require "herb/engine/visitors/debug_visitor"
require "herb/engine/visitors/optimize_visitor"
require "herb/engine/runtime/middleware"
require "herb/engine/runtime/error_page"

require_relative "snapshot_utils"

Minitest::Spec::DSL.send(:alias_method, :test, :it)
Minitest::Spec::DSL.send(:alias_method, :xtest, :xit)

Minitest.after_run do
  stale = SnapshotUtils.stale_line_fidelity_allowlist_entries

  if !stale.empty? && !ENV["UPDATE_LINE_FIDELITY_ALLOWLIST"]
    abort(<<~MESSAGE)

      Every ERB tag now compiles to the line it was written on for #{stale.size} allowlisted #{stale.size == 1 ? "test" : "tests"}.
      Remove #{stale.size == 1 ? "this entry" : "these entries"} from test/line_fidelity_allowlist.txt:

      #{stale.sort.map { |entry| "  #{entry}" }.join("\n")}
    MESSAGE
  end
end

def cyclic_string(length)
  sequence = ("a".."z").to_a + ("0".."9").to_a
  sequence.cycle.take(length).join
end

module Analyze
  module ActionView
  end
end
