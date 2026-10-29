# frozen_string_literal: true

$LOAD_PATH.unshift File.expand_path("../../../lib", __dir__)
$LOAD_PATH.unshift File.expand_path("../lib", __dir__)

require "fileutils"
require "maxitest/autorun"
require "open3"
require "rubocop/herb"
require "tmpdir"

Minitest::Spec::DSL.send(:alias_method, :test, :it)

module RuboCopHerbTestHelpers
  LOAD_PATHS = [File.expand_path("../../../lib", __dir__), File.expand_path("../lib", __dir__)].freeze

  def run_rubocop(*args)
    command = [Gem.ruby, *LOAD_PATHS.map { |path| "-I#{path}" }, Gem.bin_path("rubocop", "rubocop"), "--cache", "false", *args]
    output, error, status = Open3.capture3(*command, chdir: @directory)

    [output, error, status.exitstatus]
  end
end
