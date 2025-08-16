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

    assert_snapshot_matches(expected, source, {})

    assert_equal "TOKEN_EOF", result.value.last.type
    assert_equal source.to_s.bytesize, result.value.last.range.from
    assert_equal source.to_s.bytesize, result.value.last.range.to

    result
  end

  def assert_parsed_snapshot(source, **options)
    result = Herb.parse(source, **options)
    expected = result.value.inspect

    assert_snapshot_matches(expected, source, options)

    result
  end

  def assert_compiled_snapshot(source, options = {})
    require_relative "../lib/herb/engine"

    engine = Herb::Engine.new(source, options)
    expected = engine.src

    snapshot_key = { source: source, options: options }.to_s
    assert_snapshot_matches(expected, snapshot_key)

    engine
  end

  def assert_evaluated_snapshot(source, locals = {}, options = {})
    require_relative "../lib/herb/engine"

    engine = Herb::Engine.new(source, options)
    binding_context = Object.new

    locals.each do |key, value|
      binding_context.define_singleton_method(key) { value }
    end

    result = binding_context.instance_eval(engine.src)

    snapshot_key = {
      source: source,
      locals: locals,
      options: options,
    }.to_s

    assert_snapshot_matches(result, snapshot_key)

    { engine: engine, result: result }
  end

  def snapshot_changed?(content, source, options = {})
    if snapshot_file(source, options).exist?
      previous_content = snapshot_file(source, options).read

      if previous_content == content
        puts "\n\nSnapshot for '#{class_name} #{name}' didn't change: \n#{snapshot_file(source, options)}\n"
        false
      else
        puts "\n\nSnapshot for '#{class_name} #{name}' changed:\n"

        puts Difftastic::Differ.new(color: :always).diff_strings(previous_content, content)
        puts "==============="
        true
      end
    else
      puts "\n\nSnapshot for '#{class_name} #{name}' doesn't exist at: \n#{snapshot_file(source, options)}\n"
      true
    end
  end

  def save_failures_to_snapshot(content, source, options = {})
    return unless snapshot_changed?(content, source, options)

    puts "\n==== [ Input for '#{class_name} #{name}' ] ====="
    puts source
    puts "\n\n"

    if !ENV["FORCE_UPDATE_SNAPSHOTS"].nil? ||
       ask?("Do you want to update (or create) the snapshot for '#{class_name} #{name}'?")

      puts "\nUpdating Snapshot for '#{class_name} #{name}' at: \n#{snapshot_file(source, options)}\n"

      FileUtils.mkdir_p(snapshot_file(source, options).dirname)
      snapshot_file(source, options).write(content)

      puts "\nSnapshot for '#{class_name} #{name}' written: \n#{snapshot_file(source, options)}\n"
    else
      puts "\nNot updating snapshot for '#{class_name} #{name}' at: \n#{snapshot_file(source, options)}.\n"
    end
  end

  def assert_snapshot_matches(actual, source, options = {})
    assert snapshot_file(source, options).exist?,
           "Expected snapshot file to exist: \n#{snapshot_file(source, options).to_path}"

    assert_equal snapshot_file(source, options).read, actual
  rescue Minitest::Assertion => e
    save_failures_to_snapshot(actual, source, options) if ENV["UPDATE_SNAPSHOTS"] || ENV["FORCE_UPDATE_SNAPSHOTS"]

    raise unless snapshot_file(source, options).exist?

    if snapshot_file(source, options)&.read != actual
      puts

      divider = "=" * `tput cols`.strip.to_i

      flunk(<<~MESSAGE)
        \e[0m
        #{divider}
        #{Difftastic::Differ.new(color: :always).diff_strings(snapshot_file(source, options).read, actual)}
        \e[31m#{divider}

        Snapshots for "#{class_name} #{name}" didn't match.

        Run the test using UPDATE_SNAPSHOTS=true to update (or create) the snapshot file for "#{class_name} #{name}"

        UPDATE_SNAPSHOTS=true mtest #{e.location}

        #{divider}
        \e[0m
      MESSAGE
    end
  end

  def snapshot_file(source, options = {})
    test_class_name = underscore(self.class.name)

    content_hash = Digest::MD5.hexdigest(source || "#{source.class}-#{source.inspect}")

    test_name = name.gsub(" ", "_").gsub("/", "_")

    if options && !options.empty?
      options_hash = Digest::MD5.hexdigest(options.inspect)
      expected_snapshot_filename = "#{test_name}_#{content_hash}-#{options_hash}.txt"
    else
      expected_snapshot_filename = "#{test_name}_#{content_hash}.txt"
    end

    base_path = Pathname.new("test/snapshots/") / test_class_name
    expected_snapshot_path = base_path / expected_snapshot_filename

    return expected_snapshot_path if expected_snapshot_path.exist?

    matching_md5_files = if options && !options.empty?
                           Dir[base_path / "*_#{content_hash}-#{options_hash}.txt"]
                         else
                           Dir[base_path / "*_#{content_hash}.txt"]
                         end

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
