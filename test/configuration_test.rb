# frozen_string_literal: true

require_relative "test_helper"
require "tempfile"
require "fileutils"

class ConfigurationTest < Minitest::Spec
  def setup
    @temp_dir = Dir.mktmpdir("herb_config_test")
  end

  def teardown
    FileUtils.rm_rf(@temp_dir)
    Herb.reset_configuration!
  end

  def write_config(content, filename = ".herb.yml")
    File.write(File.join(@temp_dir, filename), content)
  end

  test "loads default configuration when no config file exists" do
    config = Herb::Configuration.load(@temp_dir)

    assert_nil config.config_path
    assert_equal Herb::Configuration::DEFAULTS["files"]["include"], config.file_include_patterns
    assert_equal Herb::Configuration::DEFAULTS["files"]["exclude"], config.file_exclude_patterns
  end

  test "loads configuration from .herb.yml" do
    write_config(<<~YAML)
      version: "0.8.10"
      files:
        include:
          - "**/*.custom.erb"
    YAML

    config = Herb::Configuration.load(@temp_dir)

    assert_equal File.join(@temp_dir, ".herb.yml"), config.config_path.to_s
    assert_equal "0.8.10", config.version
    assert_includes config.file_include_patterns, "**/*.custom.erb"
  end

  test "searches parent directories for config file" do
    subdir = File.join(@temp_dir, "app", "views")
    FileUtils.mkdir_p(subdir)

    write_config(<<~YAML)
      version: "0.8.10"
      files:
        include:
          - "**/*.custom.erb"
    YAML

    config = Herb::Configuration.load(subdir)

    assert_equal File.join(@temp_dir, ".herb.yml"), config.config_path.to_s
    assert_includes config.file_include_patterns, "**/*.custom.erb"
  end

  test "include patterns are additive with defaults" do
    write_config(<<~YAML)
      files:
        include:
          - "**/*.custom.erb"
    YAML

    config = Herb::Configuration.load(@temp_dir)

    assert_includes config.file_include_patterns, "**/*.html"
    assert_includes config.file_include_patterns, "**/*.html.erb"
    assert_includes config.file_include_patterns, "**/*.custom.erb"
  end

  test "exclude patterns are additive with defaults" do
    write_config(<<~YAML)
      files:
        exclude:
          - "custom/**/*"
    YAML

    config = Herb::Configuration.load(@temp_dir)

    assert_includes config.file_exclude_patterns, "node_modules/**/*"
    assert_includes config.file_exclude_patterns, "vendor/**/*"
    assert_includes config.file_exclude_patterns, "custom/**/*"
  end

  test "exclude patterns that duplicate defaults result in duplicates" do
    write_config(<<~YAML)
      files:
        exclude:
          - "vendor/**/*"
    YAML

    config = Herb::Configuration.load(@temp_dir)

    vendor_count = config.file_exclude_patterns.count { |p| p == "vendor/**/*" }
    assert_equal 2, vendor_count
  end

  test "linter_include_patterns combines files and linter patterns" do
    write_config(<<~YAML)
      files:
        include:
          - "**/*.xml.erb"
      linter:
        include:
          - "**/*.custom.erb"
    YAML

    config = Herb::Configuration.load(@temp_dir)

    assert_includes config.linter_include_patterns, "**/*.html.erb"
    assert_includes config.linter_include_patterns, "**/*.xml.erb"
    assert_includes config.linter_include_patterns, "**/*.custom.erb"
  end

  test "linter_exclude_patterns combines files and linter patterns" do
    write_config(<<~YAML)
      files:
        exclude:
          - "public/**/*"
      linter:
        exclude:
          - "legacy/**/*"
    YAML

    config = Herb::Configuration.load(@temp_dir)

    assert_includes config.linter_exclude_patterns, "node_modules/**/*"
    assert_includes config.linter_exclude_patterns, "public/**/*"
    assert_includes config.linter_exclude_patterns, "legacy/**/*"
  end

  test "formatter_include_patterns combines files and formatter patterns" do
    write_config(<<~YAML)
      files:
        include:
          - "**/*.xml.erb"
      formatter:
        include:
          - "**/*.custom.erb"
    YAML

    config = Herb::Configuration.load(@temp_dir)

    assert_includes config.formatter_include_patterns, "**/*.html.erb"
    assert_includes config.formatter_include_patterns, "**/*.xml.erb"
    assert_includes config.formatter_include_patterns, "**/*.custom.erb"
  end

  test "formatter_exclude_patterns combines files and formatter patterns" do
    write_config(<<~YAML)
      files:
        exclude:
          - "public/**/*"
      formatter:
        exclude:
          - "generated/**/*"
    YAML

    config = Herb::Configuration.load(@temp_dir)

    assert_includes config.formatter_exclude_patterns, "node_modules/**/*"
    assert_includes config.formatter_exclude_patterns, "public/**/*"
    assert_includes config.formatter_exclude_patterns, "generated/**/*"
  end

  test "linter_enabled_for_path? returns true for normal paths" do
    config = Herb::Configuration.load(@temp_dir)

    assert config.linter_enabled_for_path?("app/views/home/index.html.erb")
  end

  test "linter_enabled_for_path? returns false for default excluded paths" do
    config = Herb::Configuration.load(@temp_dir)

    refute config.linter_enabled_for_path?("node_modules/pkg/file.html.erb")
    refute config.linter_enabled_for_path?("vendor/bundle/file.html.erb")
  end

  test "linter_enabled_for_path? respects files.exclude" do
    write_config(<<~YAML)
      files:
        exclude:
          - "public/**/*"
    YAML

    config = Herb::Configuration.load(@temp_dir)

    refute config.linter_enabled_for_path?("public/assets/file.html.erb")
    assert config.linter_enabled_for_path?("app/views/home/index.html.erb")
  end

  test "linter_enabled_for_path? respects linter.exclude" do
    write_config(<<~YAML)
      linter:
        exclude:
          - "legacy/**/*"
    YAML

    config = Herb::Configuration.load(@temp_dir)

    refute config.linter_enabled_for_path?("legacy/old.html.erb")
    assert config.linter_enabled_for_path?("app/views/home/index.html.erb")
  end

  test "enabled_for_path? combines all exclude levels" do
    write_config(<<~YAML)
      files:
        exclude:
          - "public/**/*"
      linter:
        exclude:
          - "legacy/**/*"
    YAML

    config = Herb::Configuration.load(@temp_dir)

    refute config.enabled_for_path?("node_modules/pkg/file.html.erb", :linter)
    refute config.enabled_for_path?("public/assets/file.html.erb", :linter)
    refute config.enabled_for_path?("legacy/old.html.erb", :linter)
    assert config.enabled_for_path?("app/views/home/index.html.erb", :linter)
  end

  test "tool include can override parent excludes" do
    write_config(<<~YAML)
      files:
        exclude:
          - "vendor/**/*"
      linter:
        include:
          - "vendor/special/**/*"
    YAML

    config = Herb::Configuration.load(@temp_dir)

    refute config.enabled_for_path?("vendor/bundle/file.html.erb", :linter)
    assert config.enabled_for_path?("vendor/special/file.html.erb", :linter)
    refute config.enabled_for_path?("vendor/special/file.html.erb", :formatter)
  end

  test "tool include can override default excludes" do
    write_config(<<~YAML)
      linter:
        include:
          - "node_modules/my-pkg/**/*"
    YAML

    config = Herb::Configuration.load(@temp_dir)

    refute config.enabled_for_path?("node_modules/other/file.html.erb", :linter)
    assert config.enabled_for_path?("node_modules/my-pkg/file.html.erb", :linter)
  end

  test "tool exclude still applies when tool include overrides parent excludes" do
    write_config(<<~YAML)
      files:
        exclude:
          - "vendor/**/*"
      linter:
        include:
          - "vendor/**/*"
        exclude:
          - "vendor/legacy/**/*"
    YAML

    config = Herb::Configuration.load(@temp_dir)

    assert config.enabled_for_path?("vendor/bundle/file.html.erb", :linter)
    refute config.enabled_for_path?("vendor/legacy/old.html.erb", :linter)
  end

  test "handles invalid YAML gracefully" do
    write_config("invalid: yaml: content: [")

    config = Herb::Configuration.load(@temp_dir)

    assert_equal Herb::Configuration::DEFAULTS["files"]["include"], config.file_include_patterns
  end

  test "bracket accessor works" do
    write_config(<<~YAML)
      files:
        include:
          - "**/*.custom.erb"
      custom:
        key: value
    YAML

    config = Herb::Configuration.load(@temp_dir)

    assert_includes config["files"]["include"], "**/*.custom.erb"
    assert_equal({ "key" => "value" }, config["custom"])
  end

  test "dig method works" do
    write_config(<<~YAML)
      files:
        include:
          - "**/*.custom.erb"
    YAML

    config = Herb::Configuration.load(@temp_dir)

    assert_includes config.dig(:files, :include), "**/*.custom.erb"
  end

  test "module-level configuration accessor" do
    write_config(<<~YAML)
      files:
        include:
          - "**/*.custom.erb"
    YAML

    Herb.configure(@temp_dir)

    assert_includes Herb.configuration.file_include_patterns, "**/*.custom.erb"
  end

  test "reset_configuration clears cached config" do
    Herb.configure(@temp_dir)
    first_config = Herb.configuration

    Herb.reset_configuration!

    write_config(<<~YAML)
      files:
        include:
          - "**/*.custom.erb"
    YAML

    Herb.configure(@temp_dir)
    second_config = Herb.configuration

    refute_same first_config, second_config
  end

  test "default_file_patterns class method returns defaults" do
    patterns = Herb::Configuration.default_file_patterns

    assert_includes patterns, "**/*.html"
    assert_includes patterns, "**/*.html.erb"
    assert_includes patterns, "**/*.turbo_stream.erb"
  end

  test "default_exclude_patterns class method returns defaults" do
    patterns = Herb::Configuration.default_exclude_patterns

    assert_includes patterns, "node_modules/**/*"
    assert_includes patterns, "vendor/**/*"
  end

  test "linter config is accessible" do
    write_config(<<~YAML)
      linter:
        enabled: false
    YAML

    config = Herb::Configuration.load(@temp_dir)

    assert_equal false, config.linter["enabled"]
  end

  test "formatter config is accessible" do
    write_config(<<~YAML)
      formatter:
        enabled: true
        indentWidth: 4
    YAML

    config = Herb::Configuration.load(@temp_dir)

    assert_equal true, config.formatter["enabled"]
    assert_equal 4, config.formatter["indentWidth"]
  end

  test "stops at project root with .git directory" do
    FileUtils.mkdir_p(File.join(@temp_dir, ".git"))
    subdir = File.join(@temp_dir, "app", "views")
    FileUtils.mkdir_p(subdir)

    config = Herb::Configuration.load(subdir)

    assert_nil config.config_path
    assert_equal @temp_dir, config.project_root.to_s
  end

  test "stops at project root with Gemfile" do
    File.write(File.join(@temp_dir, "Gemfile"), "source 'https://rubygems.org'")
    subdir = File.join(@temp_dir, "app", "views")
    FileUtils.mkdir_p(subdir)

    config = Herb::Configuration.load(subdir)

    assert_nil config.config_path
    assert_equal @temp_dir, config.project_root.to_s
  end

  test "stops at project root with package.json" do
    File.write(File.join(@temp_dir, "package.json"), "{}")
    subdir = File.join(@temp_dir, "app", "views")
    FileUtils.mkdir_p(subdir)

    config = Herb::Configuration.load(subdir)

    assert_nil config.config_path
    assert_equal @temp_dir, config.project_root.to_s
  end

  test "project_root is set when config file is found" do
    write_config(<<~YAML)
      files:
        include:
          - "**/*.custom.erb"
    YAML

    subdir = File.join(@temp_dir, "app", "views")
    FileUtils.mkdir_p(subdir)

    config = Herb::Configuration.load(subdir)

    assert_equal File.join(@temp_dir, ".herb.yml"), config.config_path.to_s
    assert_equal @temp_dir, config.project_root.to_s
  end

  test "find_files returns matching files" do
    FileUtils.mkdir_p(File.join(@temp_dir, "app", "views"))
    File.write(File.join(@temp_dir, "app", "views", "index.html.erb"), "")
    File.write(File.join(@temp_dir, "app", "views", "show.html.erb"), "")
    File.write(File.join(@temp_dir, "app", "views", "other.txt"), "")

    config = Herb::Configuration.load(@temp_dir)
    files = config.find_files

    assert_equal 2, files.size
    assert files.any? { |f| f.end_with?("index.html.erb") }
    assert files.any? { |f| f.end_with?("show.html.erb") }
  end

  test "find_files excludes default patterns" do
    FileUtils.mkdir_p(File.join(@temp_dir, "app", "views"))
    FileUtils.mkdir_p(File.join(@temp_dir, "node_modules", "pkg"))
    File.write(File.join(@temp_dir, "app", "views", "index.html.erb"), "")
    File.write(File.join(@temp_dir, "node_modules", "pkg", "file.html.erb"), "")

    config = Herb::Configuration.load(@temp_dir)
    files = config.find_files

    assert_equal 1, files.size
    assert files.first.end_with?("index.html.erb")
  end

  test "find_files_for_tool uses tool-specific patterns" do
    write_config(<<~YAML)
      linter:
        include:
          - "**/*.custom.erb"
    YAML

    FileUtils.mkdir_p(File.join(@temp_dir, "app", "views"))
    File.write(File.join(@temp_dir, "app", "views", "index.html.erb"), "")
    File.write(File.join(@temp_dir, "app", "views", "custom.custom.erb"), "")

    config = Herb::Configuration.load(@temp_dir)

    linter_files = config.find_files_for_linter
    assert_equal 2, linter_files.size

    formatter_files = config.find_files_for_formatter
    assert_equal 1, formatter_files.size
  end

  test "find_files_for_tool respects tool-specific excludes" do
    write_config(<<~YAML)
      linter:
        exclude:
          - "app/views/legacy/**/*"
    YAML

    FileUtils.mkdir_p(File.join(@temp_dir, "app", "views", "home"))
    FileUtils.mkdir_p(File.join(@temp_dir, "app", "views", "legacy"))
    File.write(File.join(@temp_dir, "app", "views", "home", "index.html.erb"), "")
    File.write(File.join(@temp_dir, "app", "views", "legacy", "old.html.erb"), "")

    config = Herb::Configuration.load(@temp_dir)

    linter_files = config.find_files_for_linter
    assert_equal 1, linter_files.size
    assert linter_files.first.end_with?("index.html.erb")

    formatter_files = config.find_files_for_formatter
    assert_equal 2, formatter_files.size
  end

  test "find_files_for_linter convenience method" do
    FileUtils.mkdir_p(File.join(@temp_dir, "app", "views"))
    File.write(File.join(@temp_dir, "app", "views", "index.html.erb"), "")

    config = Herb::Configuration.load(@temp_dir)
    files = config.find_files_for_linter

    assert_equal 1, files.size
  end

  test "find_files_for_formatter convenience method" do
    FileUtils.mkdir_p(File.join(@temp_dir, "app", "views"))
    File.write(File.join(@temp_dir, "app", "views", "index.html.erb"), "")

    config = Herb::Configuration.load(@temp_dir)
    files = config.find_files_for_formatter

    assert_equal 1, files.size
  end
end
