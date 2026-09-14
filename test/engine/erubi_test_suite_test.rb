# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

# These tests are adapted from the erubi test suite at:
# https://github.com/jeremyevans/erubi/blob/master/test/test.rb
#
# Each test verifies that Herb::Engine produces the exact same evaluated output
# as Erubi::Engine for the given template and options.
module Engine
  class ErubiTestSuiteTest < Minitest::Spec
    include SnapshotUtils

    ERUBI_OPTS = { enforce_erubi_equality: true, enforce_actionview_erubi_equality: false }.freeze

    test "code tag with string containing erb-like content" do
      template = "<% x = '<%' %><%= x %>"

      assert_evaluated_snapshot(template, {}, **ERUBI_OPTS)
    end
  end
end
