# frozen_string_literal: true

require "fileutils"
require "reline"
require "digest"
require_relative "../bin/lib/compare_helpers"

def ask?(prompt = "")
  Readline.readline("===> #{prompt}? (y/N) ", true).squeeze(" ").strip == "y"
end

module SnapshotUtils
  include CompareHelpers

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

  def assert_compiled_snapshot(source, options = {}, **kwargs)
    require_relative "../lib/herb/engine"
    require "prism"

    enforce_erubi_equality = kwargs.delete(:enforce_erubi_equality) || false
    engine_options = options.merge(kwargs)

    engine = Herb::Engine.new(source, engine_options)
    expected = engine.src

    snapshot_key = { source: source, options: engine_options }.to_s
    assert_snapshot_matches(expected, snapshot_key)

    prism_result = Prism.parse(engine.src)
    syntax_errors = prism_result.errors.reject { |e| e.type == :invalid_yield }

    assert syntax_errors.empty?, <<~MESSAGE
      Compiled output is not valid Ruby:

      #{syntax_errors.map { |e| "  - #{e.message} (line #{e.location.start_line})" }.join("\n")}

      Compiled source:
      #{engine.src}
    MESSAGE

    if should_compare_with_erubi? || enforce_erubi_equality
      compare_with_erubi_compiled(source, engine.src, engine_options, enforce_equality: enforce_erubi_equality)
    end

    engine
  end

  def assert_evaluated_snapshot(source, locals = {}, options = {}, **kwargs)
    require_relative "../lib/herb/engine"
    require "prism"

    enforce_erubi_equality = kwargs.delete(:enforce_erubi_equality) || false
    engine_options = options.merge(kwargs)

    engine = Herb::Engine.new(source, engine_options)

    prism_result = Prism.parse(engine.src)
    syntax_errors = prism_result.errors.reject { |e| e.type == :invalid_yield }

    assert syntax_errors.empty?, <<~MESSAGE
      Compiled output is not valid Ruby:

      #{syntax_errors.map { |e| "  - #{e.message} (line #{e.location.start_line})" }.join("\n")}

      Compiled source:
      #{engine.src}
    MESSAGE

    binding_context = Object.new

    locals.each do |key, value|
      name = key.to_s

      if name.start_with?("@")
        binding_context.instance_variable_set(name, value)
      else
        binding_context.define_singleton_method(name) { value }
      end
    end

    result = binding_context.instance_eval(engine.src)

    snapshot_key = {
      source: source,
      locals: locals,
      options: engine_options,
    }.to_s

    assert_snapshot_matches(result, snapshot_key)

    if should_compare_with_erubi? || enforce_erubi_equality
      compare_with_erubi_evaluated(source, result, locals, engine_options, enforce_equality: enforce_erubi_equality)
    end

    { engine: engine, result: result }
  end

  def snapshot_changed?(content, source, options = {})
    if snapshot_file(source, options).exist?
      previous_full_snapshot = snapshot_file(source, options).read
      current_full_snapshot = format_snapshot_with_metadata(content, source, options)

      if previous_full_snapshot == current_full_snapshot
        puts "\n\nSnapshot for '#{class_name} #{name}' didn't change: \n#{snapshot_file(source, options)}\n"
        false
      else
        puts "\n\nSnapshot for '#{class_name} #{name}' changed:\n"
        puts Difftastic::Differ.new(color: :always).diff_strings(previous_full_snapshot, current_full_snapshot)
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

    should_update = if !ENV["FORCE_UPDATE_SNAPSHOTS"].nil?
                      true
                    elsif !$stdin.tty?
                      puts "\nCannot prompt for snapshot update in non-interactive terminal."
                      puts "Run with FORCE_UPDATE_SNAPSHOTS=true to update snapshots without prompting.\n"
                      false
                    else
                      ask?("Do you want to update (or create) the snapshot for '#{class_name} #{name}'?")
                    end

    if should_update
      puts "\nUpdating Snapshot for '#{class_name} #{name}' at: \n#{snapshot_file(source, options)}\n"

      FileUtils.mkdir_p(snapshot_file(source, options).dirname)
      snapshot_file(source, options).write(format_snapshot_with_metadata(content, source, options))

      puts "\nSnapshot for '#{class_name} #{name}' written: \n#{snapshot_file(source, options)}\n"
    else
      puts "\nNot updating snapshot for '#{class_name} #{name}' at: \n#{snapshot_file(source, options)}.\n"
    end
  end

  def assert_snapshot_matches(actual, source, options = {})
    assert snapshot_file(source, options).exist?,
           "Expected snapshot file to exist: \n#{snapshot_file(source, options).to_path}"

    expected_full_snapshot = snapshot_file(source, options).read
    actual_full_snapshot = format_snapshot_with_metadata(actual, source, options)

    assert_equal expected_full_snapshot, actual_full_snapshot
  rescue Minitest::Assertion => e
    save_failures_to_snapshot(actual, source, options) if ENV["UPDATE_SNAPSHOTS"] || ENV["FORCE_UPDATE_SNAPSHOTS"]

    raise unless snapshot_file(source, options).exist?

    expected_full_snapshot = snapshot_file(source, options).read
    actual_full_snapshot = format_snapshot_with_metadata(actual, source, options)

    if expected_full_snapshot != actual_full_snapshot
      puts

      divider = "=" * `tput cols`.strip.to_i

      flunk(<<~MESSAGE)
        \e[0m
        #{divider}
        #{Difftastic::Differ.new(color: :always).diff_strings(expected_full_snapshot, actual_full_snapshot)}
        \e[31m#{divider}

        Snapshots for "#{class_name} #{name}" didn't match.

        Run the test using UPDATE_SNAPSHOTS=true to update (or create) the snapshot file for "#{class_name} #{name}"

        UPDATE_SNAPSHOTS=true bundle exec minitest #{e.location}

        #{divider}
        \e[0m
      MESSAGE
    end
  end

  def snapshot_file(source, options = {})
    test_class_name = underscore(self.class.name)

    content_hash = Digest::MD5.hexdigest(source || "#{source.class}-#{source.inspect}")

    test_name = sanitize_name_for_filesystem(name)

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

  def should_compare_with_erubi?
    return false if class_name.include?("DebugMode")

    !ENV["COMPARE_WITH_ERUBI"].nil?
  end

  def compare_with_erubi_compiled(source, herb_src, options, enforce_equality: false)
    require_erubi_silently

    begin
      erubi_engine = Erubi::Engine.new(source, options)
      erubi_src = erubi_engine.src

      diff_output = diff_compiled_sources(erubi_src, herb_src)
      return unless diff_output

      message = "\n#{"=" * 80}\n"
      message += "WARNING: Herb compiled output differs from Erubi\n"
      message += "#{"=" * 80}\n"
      message += "Test: #{class_name} #{name}\n"
      message += "\nTemplate:\n#{source.inspect}\n"
      message += "\n"
      message += diff_output
      message += "\n"
      message += "#{"=" * 80}\n"

      if ENV["FAIL_ON_ERUBI_MISMATCH"] || enforce_equality
        flunk(message)
      else
        puts message
      end
    rescue StandardError
      nil
    end
  end

  def compare_with_erubi_evaluated(source, herb_result, locals, options, enforce_equality: false)
    require_erubi_silently

    begin
      erubi_engine = Erubi::Engine.new(source, options)
      binding_context = Object.new

      locals.each do |key, value|
        binding_context.define_singleton_method(key) { value }
      end

      erubi_result = binding_context.instance_eval(erubi_engine.src)

      diff_output = diff_rendered_outputs(erubi_result, herb_result)
      return unless diff_output

      message = "\n#{"=" * 80}\n"
      message += "WARNING: Herb evaluated output differs from Erubi\n"
      message += "#{"=" * 80}\n"
      message += "Test: #{class_name} #{name}\n"
      message += "\nTemplate:\n#{source.inspect}\n"
      message += "\nLocals: #{locals.inspect}\n"
      message += "\n"
      message += diff_output
      message += "\n"
      message += "#{"=" * 80}\n"

      if ENV["FAIL_ON_ERUBI_MISMATCH"] || enforce_equality
        flunk(message)
      else
        puts message
      end
    rescue StandardError
      nil
    end
  end

  def format_snapshot_with_metadata(content, source, options = {})
    metadata = build_snapshot_metadata(source, options)

    frontmatter = "---\n"
    frontmatter += "source: #{metadata["source"].inspect}\n"

    # Use YAML literal block scalar for input (preserves formatting)
    input_value = metadata["input"]
    if input_value.include?("\n")
      # Multiline: use |2- which means start content at column 0 (strip trailing newline)
      frontmatter += "input: |2-\n"
      frontmatter += input_value
      # Ensure there's a newline after the multiline block
      frontmatter += "\n" unless frontmatter.end_with?("\n")
    else
      # Single line: use regular quoted format
      frontmatter += "input: #{input_value.inspect}\n"
    end

    frontmatter += "options: #{metadata["options"].inspect}\n" if metadata["options"]

    frontmatter += "---\n"

    frontmatter + content
  end

  def build_snapshot_metadata(source, options = {})
    metadata = {
      "source" => "#{class_name}##{name}",
      "input" => source.to_s,
    }

    metadata["options"] = options unless options.empty?
    metadata
  end

  private

  def sanitize_name_for_filesystem(name)
    [
      # ntfs reserved characters
      # https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file
      ["<", "lt"],
      [">", "gt"],
      [":", ""],
      ["/", "_"],
      ["\\", ""],
      ["|", ""],
      ["?", ""],
      ["*", ""],

      [" ", "_"]
    ].inject(name) { |name, substitution| name.gsub(substitution[0], substitution[1]) }
  end

  def underscore(string)
    string.gsub("::", "/")
          .gsub(/([A-Z]+)([A-Z][a-z])/, '\1_\2')
          .gsub(/([a-z\d])([A-Z])/, '\1_\2')
          .tr("-", "_")
          .tr(" ", "_")
          .downcase
  end
end
