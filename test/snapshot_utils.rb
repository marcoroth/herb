# frozen_string_literal: true

require "fileutils"
require "readline"
require "digest"

def ask?(prompt = "")
  Readline.readline("===> #{prompt}? (y/N) ", true).squeeze(" ").strip == "y"
end

module SnapshotUtils
  def assert_lexed_snapshot(source)
    result = Herb.lex(source)
    expected = result.value.inspect

    assert_snapshot_matches(expected, source)

    assert_equal "TOKEN_EOF", result.value.last.type
    assert_equal source.to_s.bytesize, result.value.last.range.from
    assert_equal source.to_s.bytesize, result.value.last.range.to

    result
  end

  def assert_parsed_snapshot(source)
    result = Herb.parse(source)
    expected = result.value.inspect

    assert_snapshot_matches(expected, source)

    result
  end

  def snapshot_changed?(content, source)
    if snapshot_file(source).exist?
      previous_content = snapshot_file(source).read

      if previous_content == content
        puts "\n\nSnapshot for '#{class_name} #{name}' didn't change: \n#{snapshot_file(source)}\n"
        false
      else
        puts "\n\nSnapshot for '#{class_name} #{name}' changed:\n"

        puts Difftastic::Differ.new(color: :always).diff_strings(previous_content, content)
        puts "==============="
        true
      end
    else
      puts "\n\nSnapshot for '#{class_name} #{name}' doesn't exist at: \n#{snapshot_file(source)}\n"
      true
    end
  end

  def save_failures_to_snapshot(content, source)
    return unless snapshot_changed?(content, source)

    puts "\n==== [ Input for '#{class_name} #{name}' ] ====="
    puts source
    puts "\n\n"

    if !ENV["FORCE_UPDATE_SNAPSHOTS"].nil? ||
       ask?("Do you want to update (or create) the snapshot for '#{class_name} #{name}'?")

      puts "\nUpdating Snapshot for '#{class_name} #{name}' at: \n#{snapshot_file(source)}\n"

      FileUtils.mkdir_p(snapshot_file(source).dirname)
      snapshot_file(source).write(content)

      puts "\nSnapshot for '#{class_name} #{name}' written: \n#{snapshot_file(source)}\n"
    else
      puts "\nNot updating snapshot for '#{class_name} #{name}' at: \n#{snapshot_file(source)}.\n"
    end
  end

  def assert_snapshot_matches(actual, source)
    assert snapshot_file(source).exist?, "Expected snapshot file to exist: \n#{snapshot_file(source).to_path}"

    assert_equal snapshot_file(source).read, actual
  rescue Minitest::Assertion => e
    save_failures_to_snapshot(actual, source) if ENV["UPDATE_SNAPSHOTS"] || ENV["FORCE_UPDATE_SNAPSHOTS"]

    raise unless snapshot_file(source).exist?

    if snapshot_file(source)&.read != actual
      puts

      divider = "=" * `tput cols`.strip.to_i

      flunk(<<~MESSAGE)
        \e[0m
        #{divider}
        #{Difftastic::Differ.new(color: :always).diff_strings(snapshot_file(source).read, actual)}
        \e[31m#{divider}

        Snapshots for "#{class_name} #{name}" didn't match.

        Run the test using UPDATE_SNAPSHOTS=true to update (or create) the snapshot file for "#{class_name} #{name}"

        UPDATE_SNAPSHOTS=true mtest #{e.location}

        #{divider}
        \e[0m
      MESSAGE
    end
  end

  def snapshot_file(source)
    test_class_name = underscore(self.class.name)
    md5 = Digest::MD5.hexdigest(source || "#{source.class}-#{source.inspect}")
    test_name = name.gsub(" ", "_").gsub("/", "_")
    expected_snapshot_filename = "#{test_name}_#{md5}.txt"

    base_path = Pathname.new("test/snapshots/") / test_class_name
    expected_snapshot_path = base_path / expected_snapshot_filename

    return expected_snapshot_path if expected_snapshot_path.exist?

    matching_md5_files = Dir[base_path / "*_#{md5}.txt"]

    if matching_md5_files.any? && matching_md5_files.length == 1
      old_file = Pathname.new(matching_md5_files.first)

      return expected_snapshot_path if old_file.rename(expected_snapshot_path).zero?

      return old_file

    end

    expected_snapshot_path
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
