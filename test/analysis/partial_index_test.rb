# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/analysis/partial_index"

require "tmpdir"
require "fileutils"

class PartialIndexTest < Minitest::Spec
  def setup
    @project_path = Dir.mktmpdir("herb_partial_index_test")
  end

  def teardown
    FileUtils.rm_rf(@project_path)
  end

  def write(path, content = "<div></div>\n")
    full_path = File.join(@project_path, path)
    FileUtils.mkdir_p(File.dirname(full_path))
    File.write(full_path, content)
    full_path
  end

  test "resolves the view root to app/views when it is there" do
    write("app/views/posts/index.html.erb")

    assert_equal [File.join(@project_path, "app", "views")], Herb::Analysis::PartialIndex.build(@project_path).view_roots.map(&:to_s)
  end

  test "falls back to the project root when there is no app/views" do
    write("posts/index.html.erb")

    assert_equal [@project_path], Herb::Analysis::PartialIndex.build(@project_path).view_roots.map(&:to_s)
  end

  test "maps a qualified partial name to its file" do
    file = write("app/views/posts/_card.html.erb")

    assert_equal [file], Herb::Analysis::PartialIndex.build(@project_path).files_for("posts/card")
  end

  test "maps a partial at the view root without a directory prefix" do
    file = write("app/views/_banner.html.erb")

    assert_equal [file], Herb::Analysis::PartialIndex.build(@project_path).files_for("banner")
  end

  test "maps the same name in two directories to both files" do
    write("app/views/posts/_card.html.erb")
    write("app/views/admin/posts/_card.html.erb")

    index = Herb::Analysis::PartialIndex.build(@project_path)

    assert_equal 1, index.files_for("posts/card").size
    assert_equal 1, index.files_for("admin/posts/card").size
  end

  test "answers with nothing for a name it does not know" do
    write("app/views/posts/_card.html.erb")

    assert_empty Herb::Analysis::PartialIndex.build(@project_path).files_for("posts/missing")
  end

  test "ignores templates that are not partials" do
    write("app/views/posts/index.html.erb")

    assert_empty Herb::Analysis::PartialIndex.build(@project_path).names
  end

  test "strips a format segment from the partial name" do
    write("app/views/posts/_card.turbo_stream.erb")

    assert_includes Herb::Analysis::PartialIndex.build(@project_path).names, "posts/card"
  end

  test "finds partials written with the herb extension" do
    file = write("app/views/posts/_card.html.herb")

    assert_equal [file], Herb::Analysis::PartialIndex.build(@project_path).files_for("posts/card")
  end

  test "finds a partial with a bare erb extension" do
    file = write("app/views/posts/_card.erb")

    assert_equal [file], Herb::Analysis::PartialIndex.build(@project_path).files_for("posts/card")
  end

  test "collects templates that are not erb neighbours" do
    write("app/views/posts/index.html.erb")
    write("app/views/posts/README.md")

    assert_equal 1, Herb::Analysis::PartialIndex.build(@project_path).templates.size
  end

  test "puts the preferred variant first when a name has several" do
    write("app/views/posts/_card.erb")
    preferred = write("app/views/posts/_card.html.erb")

    assert_equal preferred, Herb::Analysis::PartialIndex.build(@project_path).files_for("posts/card").first
  end

  test "resolves a partial named relative to the rendering template" do
    caller_file = write("app/views/posts/show.html.erb")
    sibling = write("app/views/posts/_header.html.erb")

    assert_equal [sibling], Herb::Analysis::PartialIndex.build(@project_path).resolve("header", caller_file)
  end

  test "falls back to the application directory for an unqualified name" do
    caller_file = write("app/views/posts/show.html.erb")
    shared = write("app/views/application/_flash.html.erb")

    assert_equal [shared], Herb::Analysis::PartialIndex.build(@project_path).resolve("flash", caller_file)
  end

  test "prefers a sibling partial over the application fallback" do
    caller_file = write("app/views/posts/show.html.erb")
    sibling = write("app/views/posts/_flash.html.erb")
    write("app/views/application/_flash.html.erb")

    assert_equal [sibling], Herb::Analysis::PartialIndex.build(@project_path).resolve("flash", caller_file)
  end

  test "does not fall back to application for a qualified name" do
    caller_file = write("app/views/posts/show.html.erb")
    write("app/views/application/_flash.html.erb")

    assert_empty Herb::Analysis::PartialIndex.build(@project_path).resolve("admin/flash", caller_file)
  end

  test "prefers an exact name over a sibling of the same name" do
    caller_file = write("app/views/posts/show.html.erb")
    exact = write("app/views/_header.html.erb")
    write("app/views/posts/posts/_header.html.erb")

    assert_equal [exact], Herb::Analysis::PartialIndex.build(@project_path).resolve("header", caller_file)
  end

  test "takes an explicit template list when one is given" do
    write("app/views/posts/_card.html.erb")
    kept = write("app/views/posts/_byline.html.erb")

    index = Herb::Analysis::PartialIndex.build(@project_path, templates: [kept])

    assert_equal ["posts/byline"], index.names
  end
end
