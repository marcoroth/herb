# frozen_string_literal: true

require "fileutils"
require "readline"

def ask?(prompt = "")
  Readline.readline("===> #{prompt}? (y/N) ", true).squeeze(" ").strip == "y"
end

module SnapshotUtils
  def snapshot_changed?(content)
    if snapshot_file.exist?
      previous_content = snapshot_file.read

      if previous_content == content
        puts "\n\nSnapshot for '#{class_name} #{name}' didn't change: \n#{snapshot_file}\n"
        false
      else
        puts "\n\nSnapshot for '#{class_name} #{name}' changed:\n"

        puts Difftastic::Differ.new(color: :always).diff_strings(previous_content, content)
        puts "==============="
        true
      end
    else
      puts "\n\nSnapshot for '#{class_name} #{name}' doesn't exist at: \n#{snapshot_file}\n"
      true
    end
  end

  def save_failures_to_snapshot(content, source)
    return unless snapshot_changed?(content)

    puts "\n==== [ Input for '#{class_name} #{name}' ] ====="
    puts source
    puts "\n\n"

    if ask?("Do you want to update the snapshot for '#{class_name} #{name}'?")
      puts "\nUpdating Snapshot for '#{class_name} #{name}' at: \n#{snapshot_file}...\n"

      FileUtils.mkdir_p(snapshot_file.dirname)
      snapshot_file.write(content)

      puts "\nSnapshot for '#{class_name} #{name}' written: \n#{snapshot_file}\n"
    else
      puts "\nNot updating snapshot for '#{class_name} #{name}' at: \n#{snapshot_file}.\n"
    end
  end

  def assert_snapshot_matches(actual, source)
    assert snapshot_file.exist?, "Expected snapshot file to exist: \n#{snapshot_file.to_path}"

    assert_equal snapshot_file.read, actual
  rescue Minitest::Assertion => e
    save_failures_to_snapshot(actual, source) if ENV["UPDATE_SNAPSHOTS"]

    if snapshot_file.read != actual
      puts

      divider = "=" * `tput cols`.strip.to_i

      flunk(<<~MESSAGE)
        \e[0m
        #{divider}
        #{Difftastic::Differ.new(color: :always).diff_strings(snapshot_file.read, actual)}
        \e[31m#{divider}

        Snapshots for "#{class_name} #{name}" didn't match.

        Run the test using UPDATE_SNAPSHOTS=true to update (or create) the snapshot file for "#{class_name} #{name}"

        UPDATE_SNAPSHOTS=true mtest #{e.location}

        #{divider}
        \e[0m
      MESSAGE
    end
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
