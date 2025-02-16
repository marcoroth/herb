# frozen_string_literal: true

require "fileutils"

module SnapshotUtils
  def save_failures_to_snapshot(content)
    puts "Updating Snapshot for #{name} at: #{snapshot_file}"

    FileUtils.mkdir_p(snapshot_file.dirname)
    snapshot_file.write(content)
  end

  def assert_snapshot_matches(actual)
    assert snapshot_file.exist?, "Expected snapshot file to exist: #{snapshot_file.to_path}"

    assert_equal snapshot_file.read, actual
  end

  def snapshot_file
    test_class_name = underscore(self.class.name)

    @snapshot_file ||= Pathname.new("ext/erbx/test/snapshots/#{test_class_name}/#{name.gsub(" ", "_")}.txt")
  end

  private

  def underscore(string)
    string.gsub("::", "/")
          .gsub(/([A-Z]+)([A-Z][a-z])/, '\1_\2')
          .gsub(/([a-z\d])([A-Z])/, '\1_\2')
          .tr("-", "_")
          .downcase
  end
end
