# frozen_string_literal: true

require_relative "../test_helper"
require "fileutils"
require "tmpdir"

class RubocopCLITest < Minitest::Spec
  def setup
    @temp_dir = Dir.mktmpdir("herb_rubocop_cli_test")
    @template = File.join(@temp_dir, "app/views/example.html.erb")
    FileUtils.mkdir_p(File.dirname(@template))
    File.write(@template, "<%= x=1 %>\n")
    File.write(File.join(@temp_dir, ".herb.yml"), <<~YAML)
      rubocop:
        enabled: true
        rubocop_config:
          AllCops:
            DisabledByDefault: true
          Layout/SpaceAroundOperators:
            Enabled: true
    YAML
  end

  def teardown
    FileUtils.rm_rf(@temp_dir)
  end

  test "reports offenses and exits unsuccessfully" do
    output, error = capture_io do
      exit_error = assert_raises(SystemExit) do
        Herb::CLI.new(["rubocop", @template]).call
      end

      assert_equal 1, exit_error.status
    end

    assert_empty error
    assert_includes output, "Layout/SpaceAroundOperators"
    assert_includes output, "1 file inspected, 1 offense detected"
  end

  test "autocorrects offenses" do
    capture_io do
      exit_error = assert_raises(SystemExit) do
        Herb::CLI.new(["rubocop", @template, "--autocorrect"]).call
      end

      assert_equal 0, exit_error.status
    end

    assert_equal "<%= x = 1 %>\n", File.read(@template)
  end
end
