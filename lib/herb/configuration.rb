# frozen_string_literal: true

require "yaml"
require "pathname"

module Herb
  class Configuration
    CONFIG_FILENAMES = [".herb.yml"].freeze

    PROJECT_INDICATORS = [
      ".git",
      ".herb",
      ".herb.yml",
      "Gemfile",
      "package.json",
      "Rakefile",
      "README.md",
      "*.gemspec",
      "config/application.rb"
    ].freeze

    DEFAULTS_PATH = File.expand_path("defaults.yml", __dir__).freeze
    DEFAULTS = YAML.safe_load_file(DEFAULTS_PATH).freeze

    attr_reader :config, :config_path, :project_root

    def initialize(project_path = nil)
      @start_path = project_path ? Pathname.new(project_path) : Pathname.pwd
      @config_path, @project_root = find_config_file
      @config = load_config
    end

    def [](key)
      @config[key.to_s]
    end

    def dig(*keys)
      @config.dig(*keys.map(&:to_s))
    end

    def version
      @config["version"]
    end

    def files
      @config["files"] || {}
    end

    def file_include_patterns
      files["include"] || DEFAULTS.dig("files", "include") || []
    end

    def file_exclude_patterns
      files["exclude"] || DEFAULTS.dig("files", "exclude") || []
    end

    def linter
      @config["linter"] || {}
    end

    def formatter
      @config["formatter"] || {}
    end

    def include_patterns_for(tool)
      tool_config = send(tool.to_s)
      file_include_patterns + (tool_config["include"] || [])
    end

    def exclude_patterns_for(tool)
      tool_config = send(tool.to_s)
      file_exclude_patterns + (tool_config["exclude"] || [])
    end

    def linter_include_patterns
      include_patterns_for(:linter)
    end

    def linter_exclude_patterns
      exclude_patterns_for(:linter)
    end

    def formatter_include_patterns
      include_patterns_for(:formatter)
    end

    def formatter_exclude_patterns
      exclude_patterns_for(:formatter)
    end

    def enabled_for_path?(path, tool)
      tool_config = send(tool.to_s)
      tool_include = tool_config["include"] || []
      tool_exclude = tool_config["exclude"] || []

      if tool_include.any? && path_included?(path, tool_include)
        return !path_excluded?(path, tool_exclude)
      end

      exclude_patterns = exclude_patterns_for(tool)

      !path_excluded?(path, exclude_patterns)
    end

    def linter_enabled_for_path?(path)
      enabled_for_path?(path, :linter)
    end

    def formatter_enabled_for_path?(path)
      enabled_for_path?(path, :formatter)
    end

    def path_excluded?(path, patterns)
      patterns.any? { |pattern| File.fnmatch?(pattern, path, File::FNM_PATHNAME) }
    end

    def path_included?(path, patterns)
      patterns.any? { |pattern| File.fnmatch?(pattern, path, File::FNM_PATHNAME) }
    end

    def find_files(search_path = nil)
      search_path ||= @project_root || @start_path
      expanded_path = File.expand_path(search_path.to_s)

      all_files = file_include_patterns.flat_map do |pattern|
        Dir[File.join(expanded_path, pattern)]
      end.uniq

      all_files.reject do |file|
        relative = file.sub("#{expanded_path}/", "")
        path_excluded?(relative, file_exclude_patterns)
      end.sort
    end

    def find_files_for_tool(tool, search_path = nil)
      search_path ||= @project_root || @start_path
      expanded_path = File.expand_path(search_path.to_s)

      include_patterns = include_patterns_for(tool)
      exclude_patterns = exclude_patterns_for(tool)

      all_files = include_patterns.flat_map do |pattern|
        Dir[File.join(expanded_path, pattern)]
      end.uniq

      all_files.reject do |file|
        relative = file.sub("#{expanded_path}/", "")
        path_excluded?(relative, exclude_patterns)
      end.sort
    end

    def find_files_for_linter(search_path = nil)
      find_files_for_tool(:linter, search_path)
    end

    def find_files_for_formatter(search_path = nil)
      find_files_for_tool(:formatter, search_path)
    end

    class << self
      def load(project_path = nil)
        new(project_path)
      end

      def default
        @default ||= new
      end

      def default_file_patterns
        DEFAULTS.dig("files", "include") || []
      end

      def default_exclude_patterns
        DEFAULTS.dig("files", "exclude") || []
      end
    end

    private

    def find_config_file
      search_path = @start_path
      search_path = search_path.parent if search_path.file?

      while search_path.to_s != "/"
        CONFIG_FILENAMES.each do |filename|
          config_file = search_path / filename
          return [config_file, search_path] if config_file.exist?
        end

        return [nil, search_path] if project_root?(search_path)

        search_path = search_path.parent
      end

      [nil, @start_path]
    end

    def project_root?(path)
      PROJECT_INDICATORS.any? do |indicator|
        if indicator.include?("*")
          Dir.glob(path / indicator).any?
        else
          (path / indicator).exist?
        end
      end
    end

    def load_config
      return deep_merge(DEFAULTS, {}) unless @config_path&.exist?

      begin
        user_config = YAML.safe_load_file(@config_path, permitted_classes: [Symbol]) || {}
        deep_merge(DEFAULTS, user_config)
      rescue Psych::SyntaxError => e
        warn "Warning: Invalid YAML in #{@config_path}: #{e.message}"
        deep_merge(DEFAULTS, {})
      end
    end

    def deep_merge(base, override, additive_keys: ["include", "exclude"])
      base.merge(override) do |key, old_val, new_val|
        if old_val.is_a?(Hash) && new_val.is_a?(Hash)
          deep_merge(old_val, new_val, additive_keys: additive_keys)
        elsif old_val.is_a?(Array) && new_val.is_a?(Array) && additive_keys.include?(key)
          old_val + new_val
        else
          new_val
        end
      end
    end
  end
end
