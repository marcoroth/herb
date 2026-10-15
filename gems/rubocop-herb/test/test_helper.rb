# frozen_string_literal: true

root = File.expand_path("../../..", __dir__)
$LOAD_PATH.unshift File.join(root, "lib")
$LOAD_PATH.unshift File.expand_path("../lib", __dir__)

require "herb"
require "fileutils"
require "maxitest/autorun"
require "minitest/spec"
require "open3"
require "rubocop/herb"
require "tmpdir"

Minitest::Spec::DSL.send(:alias_method, :test, :it)

module RuboCopHerbTestHelpers
  ROOT = File.expand_path("../../..", __dir__)

  def run_rubocop(*, chdir:)
    Open3.capture3(
      { "BUNDLE_GEMFILE" => File.join(ROOT, "Gemfile") },
      RbConfig.ruby,
      "-S",
      "bundle",
      "exec",
      "rubocop",
      *,
      chdir:
    )
  end
end
