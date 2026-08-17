# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"

require "tmpdir"
require "fileutils"
require "open3"

module CLI
  # `check` and `graph` fan out over templates with `Parallel` in processes, so they are driven
  # through a subprocess rather than in-process, which would fork the test runner itself.
  class ActionViewCommandsTest < Minitest::Spec
    include SnapshotUtils

    REPOSITORY_ROOT = File.expand_path("../..", __dir__)

    def setup
      @project_path = Dir.mktmpdir("herb_cli_commands_test")
      @view_root = File.join(@project_path, "app", "views", "posts")
      FileUtils.mkdir_p(@view_root)
      File.write(File.join(@project_path, ".herb.yml"), "framework: actionview\n")
    end

    def teardown
      FileUtils.rm_rf(@project_path)
    end

    def write(name, content)
      path = File.join(@view_root, name)
      FileUtils.mkdir_p(File.dirname(path))
      File.write(path, content)
      path
    end

    def run_cli(*args)
      command = [
        "ruby",
        "-I#{File.join(REPOSITORY_ROOT, "lib")}",
        File.join(REPOSITORY_ROOT, "exe", "herb"),
        "actionview",
        *args
      ]

      output, status = Open3.capture2e(
        { "NO_COLOR" => "1", "BUNDLE_GEMFILE" => File.join(REPOSITORY_ROOT, "Gemfile") },
        *command,
        chdir: @project_path
      )

      [output, status.exitstatus]
    end

    def normalize(output)
      output
        .gsub(File.realpath(@project_path), "<project>")
        .gsub(@project_path, "<project>")
        .gsub(/v\d+\.\d+\.\d+/, "vVERSION")
        .gsub(/\d+(\.\d+)?\s*(ms|s)\b/, "<duration>")
    end

    def assert_cli_snapshot(args, source)
      output, status = run_cli(*args)

      assert_snapshot_matches("exit: #{status}\n#{normalize(output)}", source)
    end

    test "check reports a project where every render resolves" do
      source = '<table><%= render "posts/row" %></table>'
      write("index.html.erb", source)
      write("_row.html.erb", "<tr></tr>")

      assert_cli_snapshot(["check", "."], source)
    end

    test "check reports a render that cannot be resolved" do
      source = '<table><%= render "posts/missing" %></table>'
      write("index.html.erb", source)

      assert_cli_snapshot(["check", "."], "unresolved: #{source}")
    end

    test "check reports a partial nothing renders" do
      write("index.html.erb", "<p>hello</p>")
      write("_orphan.html.erb", "<tr></tr>")

      assert_cli_snapshot(["check", "."], "unused partial")
    end

    test "check warns about an instance variable used inside a partial" do
      source = '<%= render "posts/row" %>'
      write("index.html.erb", source)
      write("_row.html.erb", "<tr><%= @post.title %></tr>")

      assert_cli_snapshot(["check", "."], "ivar in partial: #{source}")
    end

    test "graph shows the render tree for a project" do
      source = '<table><%= render "posts/row" %></table>'
      write("index.html.erb", source)
      write("_row.html.erb", '<tr><%= render "posts/cell" %></tr>')
      write("_cell.html.erb", "<td></td>")

      assert_cli_snapshot(["graph"], "project graph: #{source}")
    end

    test "graph shows who renders a single partial" do
      write("index.html.erb", '<table><%= render "posts/row" %></table>')
      row = write("_row.html.erb", "<tr></tr>")

      assert_cli_snapshot(["graph", row], "single partial graph")
    end

    test "graph shows an entry point" do
      entry = write("index.html.erb", '<table><%= render "posts/row" %></table>')
      write("_row.html.erb", "<tr></tr>")

      assert_cli_snapshot(["graph", entry], "entry point graph")
    end

    test "dependencies reports the manifest for a template" do
      source = "<h1><%= @post.title %></h1><%= link_to \"Home\", \"/\" %>"
      entry = write("show.html.erb", source)

      assert_cli_snapshot(["dependencies", entry], source)
    end

    test "dependencies reports state flow into a partial" do
      source = '<%= render "posts/row", post: @post %>'
      entry = write("show.html.erb", source)
      write("_row.html.erb", "<tr><%= post.title %></tr>")

      assert_cli_snapshot(["dependencies", entry], "state flow: #{source}")
    end

    test "dependencies reports a partial's declared locals" do
      row = write("_row.html.erb", "<%# locals: (post:) %>\n<tr><%= post.title %></tr>")

      assert_cli_snapshot(["dependencies", row], "partial manifest")
    end

    test "render renders a template with ActionView helpers" do
      entry = write("show.html.erb", '<%= link_to "Home", "/" %>')

      assert_cli_snapshot(["render", entry], "actionview render")
    end

    test "an unconfigured project is told how to enable ActionView" do
      File.write(File.join(@project_path, ".herb.yml"), "framework: rails\n")
      write("index.html.erb", "<p>hello</p>")

      assert_cli_snapshot(["check", "."], "unconfigured framework")
    end
  end
end
