# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/analysis/project_index"

require "tmpdir"
require "fileutils"

class ProjectIndexTest < Minitest::Spec
  def setup
    @project_path = Dir.mktmpdir("herb_project_index_test")
    @view_root = File.join(@project_path, "app", "views", "posts")
    FileUtils.mkdir_p(@view_root)
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

  def indexed
    project = Herb::Analysis::ProjectIndex.new(@project_path)
    project.index_all
    project
  end

  def reindexed
    Herb::Analysis::ProjectIndex.new(@project_path).tap(&:index_all)
  end

  test "indexes partials and call sites" do
    write("index.html.erb", '<table><%= render "posts/row", post: post %></table>')
    row = write("_row.html.erb", "<tr></tr>")

    project = indexed

    assert_equal 1, project.partials.size
    assert_equal 1, project.graph.size
    assert_equal :always, project.graph.context_of(row).ancestor_verdict([], "table")
  end

  test "re-analyzes only the changed template" do
    entry = write("index.html.erb", '<html><body><table><%= render "posts/row", post: post %></table></body></html>')
    row = write("_row.html.erb", "<tr></tr>")

    project = indexed
    File.write(entry, '<html><body><form><%= render "posts/row", post: post %></form></body></html>')

    assert project.handle_change(entry)
    assert_equal :never, project.graph.context_of(row).ancestor_verdict([], "table")
    assert_equal :always, project.graph.context_of(row).ancestor_verdict([], "form")
  end

  test "lands in the same state as a full reindex after a change" do
    entry = write("index.html.erb", '<table><%= render "posts/row", post: post %></table>')
    write("_row.html.erb", "<tr></tr>")

    project = indexed
    File.write(entry, '<form><%= render "posts/row", post: post %></form>')
    project.handle_change(entry)

    assert_equal reindexed.graph.to_h, project.graph.to_h
  end

  test "accepts source for a template that has not been written to disk" do
    entry = write("index.html.erb", '<table><%= render "posts/row", post: post %></table>')
    row = write("_row.html.erb", "<tr></tr>")

    project = indexed
    project.handle_change(entry, '<form><%= render "posts/row", post: post %></form>')

    assert_equal :always, project.graph.context_of(row).ancestor_verdict([], "form")
  end

  test "picks up a partial added after the initial index" do
    entry = write("index.html.erb", '<table><%= render "posts/row", post: post %></table>')

    project = indexed

    assert_equal :unknown, project.graph.context_of(File.join(@view_root, "_row.html.erb")).ancestor_verdict([], "table")

    row = write("_row.html.erb", "<tr></tr>")
    project.handle_change(row)
    project.handle_change(entry)

    assert_equal :always, project.graph.context_of(row).ancestor_verdict([], "table")
    assert_equal reindexed.graph.to_h, project.graph.to_h
  end

  test "forgets a partial that was deleted" do
    write("index.html.erb", '<table><%= render "posts/row", post: post %></table>')
    row = write("_row.html.erb", "<tr></tr>")

    project = indexed

    assert project.remove(row)
    assert_equal 0, project.partials.size
  end

  test "forgets the call sites of a deleted template" do
    entry = write("index.html.erb", '<table><%= render "posts/row", post: post %></table>')
    row = write("_row.html.erb", "<tr></tr>")

    project = indexed

    assert project.remove(entry)
    assert_empty project.graph.callers_of(row)
  end

  test "reports no change for a file that is not a template" do
    write("index.html.erb", "<table></table>")

    project = indexed

    refute project.handle_change(File.join(@project_path, "README.md"))
  end

  test "tracks strict locals declared by a partial" do
    write("index.html.erb", '<%= render "posts/row", post: post %>')
    write("_row.html.erb", "<%# locals: (post:) %>\n<tr></tr>")

    declaration = indexed.partials.lookup("posts/row", nil)

    assert declaration.has_declaration
    assert_equal ["post"], declaration.required_locals
    refute declaration.accepts?("author")
  end

  test "exposes the view root it resolved" do
    write("index.html.erb", "<div></div>")

    assert_equal [File.join(@project_path, "app", "views")], indexed.view_roots.map(&:to_s)
  end
end
