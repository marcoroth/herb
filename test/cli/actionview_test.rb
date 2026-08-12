# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/cli"

require "tmpdir"
require "fileutils"
require "stringio"

module CLI
  class ActionViewTest < Minitest::Spec
    include SnapshotUtils

    def setup
      @project_path = Dir.mktmpdir("herb_cli_actionview_test")
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

    def write_layout(content)
      path = File.join(@project_path, "app", "views", "layouts", "application.html.erb")
      FileUtils.mkdir_p(File.dirname(path))
      File.write(path, content)
      path
    end

    def run_cli(*args)
      output = StringIO.new
      original = $stdout
      $stdout = output
      status = 0

      begin
        Herb::CLI.new(["actionview", *args]).call
      rescue SystemExit => e
        status = e.status
      ensure
        $stdout = original
      end

      [output.string, status]
    end

    def assert_cli_snapshot(args, source)
      output, status = run_cli(*args)

      normalized = output.gsub(@project_path, "<project>").gsub(Herb::VERSION, "VERSION")

      assert_snapshot_matches("exit: #{status}\n#{normalized}", source)
    end

    test "flow traces state into a partial" do
      source = '<%= render "posts/byline", author: @post.user %>'
      entry = write("show.html.erb", source)
      write("_byline.html.erb", "<span><%= author.name %></span>")

      assert_cli_snapshot(["flow", entry, "@post"], source)
    end

    test "flow traces state through two renames" do
      source = '<%= render "posts/byline", author: @post.user %>'
      entry = write("show.html.erb", source)
      write("_byline.html.erb", '<%= render "posts/avatar", user: author %>')
      write("_avatar.html.erb", '<img src="<%= user.avatar %>">')

      assert_cli_snapshot(["flow", entry, "@post"], "two renames: #{source}")
    end

    test "flow lists the available state when none is given" do
      source = "<h1><%= @post.title %></h1><p><%= @user.name %></p>"
      entry = write("show.html.erb", source)

      assert_cli_snapshot(["flow", entry], source)
    end

    test "flow lists the available state when the state is unknown" do
      source = "<h1><%= @post.title %></h1>"
      entry = write("show.html.erb", source)

      assert_cli_snapshot(["flow", entry, "@missing"], "unknown state: #{source}")
    end

    test "flow reports a template that reads no state" do
      source = "<p>static</p>"
      entry = write("show.html.erb", source)

      assert_cli_snapshot(["flow", entry], source)
    end

    test "flow rejects a path that is not a file" do
      assert_cli_snapshot(["flow", File.join(@view_root, "missing.html.erb")], "missing file")
    end

    test "context reports what a partial is rendered inside" do
      source = '<html><body><table><%= render "posts/row" %></table></body></html>'
      write("index.html.erb", source)
      row = write("_row.html.erb", "<tr></tr>")

      assert_cli_snapshot(["context", row], source)
    end

    test "context reports a mixed verdict across two call sites" do
      source = '<html><body><table><%= render "posts/row" %></table></body></html>'
      write("index.html.erb", source)
      write("show.html.erb", '<html><body><div><%= render "posts/row" %></div></body></html>')
      row = write("_row.html.erb", "<tr></tr>")

      assert_cli_snapshot(["context", row], "mixed: #{source}")
    end

    test "context reaches the document root through a layout" do
      write_layout("<html><body><main><%= yield %></main></body></html>")

      source = '<table><%= render "posts/row" %></table>'
      write("index.html.erb", source)
      row = write("_row.html.erb", "<tr></tr>")

      assert_cli_snapshot(["context", row], "through layout: #{source}")
    end

    test "context reports a partial nothing renders" do
      row = write("_orphan.html.erb", "<tr></tr>")

      assert_cli_snapshot(["context", row], "orphan partial")
    end

    test "signature infers strict locals from the call sites" do
      source = '<%= render "posts/row", post: post, index: index %>'
      write("index.html.erb", source)
      row = write("_row.html.erb", "<tr></tr>")

      assert_cli_snapshot(["signature", row], source)
    end

    test "signature flags a local that is passed but not declared" do
      source = '<%= render "posts/row", post: post, extra: extra %>'
      write("index.html.erb", source)
      row = write("_row.html.erb", "<%# locals: (post:) %>\n<tr></tr>")

      assert_cli_snapshot(["signature", row], "undeclared: #{source}")
    end

    test "signature reports a local that is declared but never passed" do
      source = '<%= render "posts/row", post: post %>'
      write("index.html.erb", source)
      row = write("_row.html.erb", "<%# locals: (post:, unused: nil) %>\n<tr></tr>")

      assert_cli_snapshot(["signature", row], "unused: #{source}")
    end

    test "signature reports a partial nothing renders" do
      row = write("_orphan.html.erb", "<tr></tr>")

      assert_cli_snapshot(["signature", row], "orphan signature")
    end

    test "help lists the subcommands" do
      assert_cli_snapshot(["help"], "actionview help")
    end

    test "an unknown subcommand exits with a failure" do
      assert_cli_snapshot(["nonsense"], "unknown subcommand")
    end
  end
end
