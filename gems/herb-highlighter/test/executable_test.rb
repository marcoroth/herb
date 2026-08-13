# frozen_string_literal: true

require "test_helper"
require "open3"

class ExecutableTest < Minitest::Test
  def test_resolves_the_bundled_binary
    assert File.executable?(Herb::Highlighter.executable)
  end

  def test_honours_an_explicit_path
    assert_equal Herb::Highlighter.executable, Herb::Highlighter.executable(exe_path: Herb::Highlighter.executable)
  end

  def test_raises_for_a_missing_explicit_path
    assert_raises(Herb::Highlighter::ExecutableNotFoundError) do
      Herb::Highlighter.executable(exe_path: "/does/not/exist")
    end
  end

  def test_raises_for_a_missing_install_dir
    ENV["HERB_HIGHLIGHTER_INSTALL_DIR"] = "/does/not/exist"

    assert_raises(Herb::Highlighter::ExecutableNotFoundError) { Herb::Highlighter.executable }
  ensure
    ENV.delete("HERB_HIGHLIGHTER_INSTALL_DIR")
  end

  def test_the_binary_reports_its_version
    output, status = Open3.capture2(Herb::Highlighter.executable, "--version")

    assert_predicate status, :success?
    assert_includes output, "herb-highlighter@#{Herb::Highlighter::VERSION}"
  end

  def test_the_binary_highlights_a_file
    with_template do |path|
      output, status = Open3.capture2(Herb::Highlighter.executable, path)

      assert_predicate status, :success?
      assert_includes plain(output), "badge.png"
    end
  end

  # The shim requires the gem relatively, so it runs without anything on the load path.
  def test_the_shim_execs_the_binary
    shim = File.expand_path("../exe/herb-highlight", __dir__)
    output, status = Open3.capture2({ "RUBYOPT" => nil }, RbConfig.ruby, shim, "--version")

    assert_predicate status, :success?
    assert_includes output, "herb-highlighter@#{Herb::Highlighter::VERSION}"
  end
end
