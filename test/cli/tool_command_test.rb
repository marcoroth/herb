# frozen_string_literal: true

require_relative "../test_helper"

require "tmpdir"
require "fileutils"

module CLI
  class ToolCommandTest < Minitest::Spec
    def setup
      @project_path = Dir.mktmpdir("herb_cli_tool_command_test")
      @cli = Herb::CLI.new(["lint"])
    end

    def teardown
      FileUtils.rm_rf(@project_path)
    end

    def write_executable(path)
      FileUtils.mkdir_p(File.dirname(path))
      File.write(path, "#!/bin/sh\n")
      File.chmod(0o755, path)
      path
    end

    def tool_command
      Dir.chdir(@project_path) do
        @cli.send(:tool_command, "herb-lint", "@herb-tools/linter", "herb-linter")
      end
    end

    def stub_lookups(standalone: nil, path: nil, node: false, &block)
      @cli.stub(:standalone_executable, standalone) do
        @cli.stub(:find_executable_on_path, path) do
          @cli.stub(:node_available?, node, &block)
        end
      end
    end

    test "prefers the project's node_modules binary" do
      local_bin = write_executable(File.join(@project_path, "node_modules", ".bin", "herb-lint"))

      stub_lookups(standalone: "/gems/herb-linter/libexec/herb-lint", node: true) do
        assert_equal([File.realpath(local_bin)], tool_command.map { |path| File.realpath(path) })
      end
    end

    test "uses the standalone executable from the gem without Node.js" do
      stub_lookups(standalone: "/gems/herb-linter/libexec/herb-lint", path: "/usr/local/bin/herb-lint", node: false) do
        assert_equal ["/gems/herb-linter/libexec/herb-lint"], tool_command
      end
    end

    test "falls back to the executable on the PATH" do
      stub_lookups(path: "/usr/local/bin/herb-lint", node: true) do
        assert_equal ["/usr/local/bin/herb-lint"], tool_command
      end
    end

    test "falls back to npx when Node.js is available" do
      stub_lookups(node: true) do
        assert_equal ["npx", "@herb-tools/linter"], tool_command
      end
    end

    test "returns nil when neither the gem nor Node.js are available" do
      stub_lookups(node: false) do
        assert_nil tool_command
      end
    end

    test "standalone_executable finds the executable in the gem's libexec" do
      gem_dir = File.join(@project_path, "herb-linter-1.0.0")
      executable = write_executable(File.join(gem_dir, "libexec", Gem.win_platform? ? "herb-lint.exe" : "herb-lint"))
      spec = Struct.new(:gem_dir).new(gem_dir)

      Gem::Specification.stub(:find_by_name, spec) do
        assert_equal executable, @cli.send(:standalone_executable, "herb-linter", "herb-lint")
      end
    end

    test "standalone_executable returns nil for the plain ruby gem without an executable" do
      spec = Struct.new(:gem_dir).new(File.join(@project_path, "herb-linter-1.0.0"))

      Gem::Specification.stub(:find_by_name, spec) do
        assert_nil @cli.send(:standalone_executable, "herb-linter", "herb-lint")
      end
    end

    test "standalone_executable returns nil when the gem isn't installed" do
      assert_nil @cli.send(:standalone_executable, "herb-linter-not-installed", "herb-lint")
    end
  end
end
