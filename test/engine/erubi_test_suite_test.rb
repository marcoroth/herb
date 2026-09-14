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

    test "code tag with percent-q literal containing erb-like content" do
      template = "<% x = %q{<%} %><%= x %>"

      assert_evaluated_snapshot(template, {}, **ERUBI_OPTS)
    end

    test "code tag with percent-w literal containing erb-like content" do
      template = "<% x = %w[<% ok].first %><%= x %>"

      assert_evaluated_snapshot(template, {}, **ERUBI_OPTS)
    end

    test "code tag with regex literal containing erb-like content" do
      template = "<% x = /<%/.source %><%= x %>"

      assert_evaluated_snapshot(template, {}, **ERUBI_OPTS)
    end

    test "code tag with character literal for angle bracket" do
      template = "<% x = ?< %><%= x %>"

      assert_evaluated_snapshot(template, {}, **ERUBI_OPTS)
    end

    test "code tag with bareword heredoc containing erb-like content" do
      template = "<% x = <<EOT\n<%\nEOT\n%><%= x %>"

      assert_evaluated_snapshot(template, {}, **ERUBI_OPTS)
    end

    test "code tag with squiggly heredoc with indented terminator" do
      template = "<% x = <<~EOT\n  <%\n  EOT\n%><%= x %>"

      assert_evaluated_snapshot(template, {}, **ERUBI_OPTS)
    end

    test "code tag with single-quoted heredoc without interpolation" do
      template = "<% x = <<'EOT'\n<%\nEOT\n%><%= x %>"

      assert_evaluated_snapshot(template, {}, **ERUBI_OPTS)
    end
  end
end
