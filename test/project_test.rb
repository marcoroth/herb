# frozen_string_literal: true

require_relative "test_helper"

require "tmpdir"
require "fileutils"

class ProjectTest < Minitest::Spec
  def setup
    @project_path = Dir.mktmpdir("herb_project_test")
  end

  def teardown
    FileUtils.rm_rf(@project_path)
    Herb.reset_configuration!
  end

  def write(relative_path, content = "<p>hello</p>")
    path = File.join(@project_path, relative_path)
    FileUtils.mkdir_p(File.dirname(path))
    File.write(path, content)
    path
  end

  def write_config(content)
    File.write(File.join(@project_path, ".herb.yml"), content)
  end

  def files_for(project_path)
    Herb::Project.new(project_path).files.map { |file| File.basename(file) }
  end

  test "finds the templates the include patterns match" do
    write("app/views/posts/index.html.erb")
    write("README.md")

    assert_equal ["index.html.erb"], files_for(@project_path)
  end

  test "leaves out the templates the exclude patterns match" do
    write_config("files:\n  exclude:\n    - \"vendor/**\"\n")
    write("app/views/posts/index.html.erb")
    write("vendor/bundled.html.erb")

    assert_equal ["index.html.erb"], files_for(@project_path)
  end

  test "normalizes a project path given with a trailing slash" do
    write_config("files:\n  exclude:\n    - \"vendor/**\"\n")
    write("app/views/posts/index.html.erb")
    write("vendor/bundled.html.erb")

    assert_equal ["index.html.erb"], files_for("#{@project_path}/")
  end

  test "returns the templates in a stable order" do
    write("app/views/posts/b.html.erb")
    write("app/views/posts/a.html.erb")
    write("app/views/posts/c.html.erb")

    assert_equal ["a.html.erb", "b.html.erb", "c.html.erb"], files_for(@project_path)
  end

  test "uses the file paths it was given instead of searching" do
    write("app/views/posts/index.html.erb")
    only = write("app/views/posts/show.html.erb")

    project = Herb::Project.new(@project_path)
    project.file_paths = [only]

    assert_equal [only], project.files
  end

  test "finds no templates in an empty project" do
    assert_empty files_for(@project_path)
  end
end
