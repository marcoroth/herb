# frozen_string_literal: true

require_relative "test_helper"

# Windows can't check out files whose names it doesn't allow, which breaks
# `gem install herb` and cloning the repository on Windows (see #2661).
#
# https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file
class FileNamesTest < Minitest::Spec
  INVALID_CHARACTERS = /[<>:"|?*\\\x00-\x1F]/
  RESERVED_NAMES = /\A(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?\z/i

  def tracked_files
    root = File.expand_path("..", __dir__)
    output = IO.popen(["git", "-C", root, "ls-files", "-z"], err: File::NULL, &:read)

    skip "not a git checkout" unless Process.last_status.success?

    output.force_encoding(Encoding::UTF_8).split("\0")
  rescue Errno::ENOENT
    skip "git is not installed"
  end

  def offending_files(&)
    tracked_files.select { |path| path.split("/").any?(&) }
  end

  test "tracked file names don't contain characters invalid on Windows" do
    offenders = offending_files { |name| name.match?(INVALID_CHARACTERS) }

    assert_empty offenders, "File names must not contain any of < > : \" | ? * \\ or control characters"
  end

  test "tracked file names don't end with a dot or a space" do
    offenders = offending_files { |name| name.end_with?(".", " ") }

    assert_empty offenders, "File names must not end with a dot or a space"
  end

  test "tracked file names don't use names reserved on Windows" do
    offenders = offending_files { |name| name.match?(RESERVED_NAMES) }

    assert_empty offenders, "File names must not be CON, PRN, AUX, NUL, COM1-9 or LPT1-9 (with or without an extension)"
  end
end
