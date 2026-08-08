# frozen_string_literal: true

require "yaml"
require "pathname"

module Herb
  class Configuration
    OPTIONS_PATH = File.expand_path("../../config/options.yml", __dir__ || __FILE__).freeze #: String
    OPTIONS = YAML.safe_load_file(OPTIONS_PATH).freeze #: Hash[String, untyped]

    VALID_FRAMEWORKS = OPTIONS["framework"]["values"].freeze #: Array[String]
    VALID_TEMPLATE_ENGINES = OPTIONS["template_engine"]["values"].freeze #: Array[String]

    CONFIG_FILENAMES = [".herb.yml"].freeze #: Array[String]
    MISNAMED_CONFIG_FILENAMES = [".herb.yaml", "herb.yml", "herb.yaml"].freeze #: Array[String]

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
    ].freeze #: Array[String]

    DEFAULTS_PATH = File.expand_path("defaults.yml", __dir__ || __FILE__).freeze
    DEFAULTS = YAML.safe_load_file(DEFAULTS_PATH).freeze

    GEMFILE_FILENAMES = ["Gemfile", "gems.rb"].freeze #: Array[String]

    FRAMEWORK_GEMS = {
      "rails" => "actionview",
      "actionview" => "actionview",
      "hanami" => "hanami",
      "hanami-view" => "hanami",
      "sinatra" => "sinatra",
    }.freeze #: Hash[String, String]

    FRAMEWORK_PRECEDENCE = ["actionview", "hanami", "sinatra"].freeze #: Array[String]

    FRAMEWORK_LABELS = {
      "ruby" => "Ruby",
      "actionview" => "Action View",
      "hanami" => "Hanami",
      "sinatra" => "Sinatra",
    }.freeze #: Hash[String, String]

    FRAMEWORK_DESCRIPTIONS = {
      "ruby" => "plain ERB templates, with no framework helpers in scope",
      "actionview" => "Action View templates, with their helpers, partials, and strict locals",
      "hanami" => "Hanami views, with their parts and helpers",
      "sinatra" => "Sinatra templates, with their helpers",
    }.freeze #: Hash[String, String]

    attr_reader :config, :user_config, :config_path, :project_root, :misnamed_config_paths

    def initialize(project_path = nil)
      @start_path = project_path ? Pathname.new(project_path) : Pathname.pwd
      @config_path, @project_root = find_config_file
      @misnamed_config_paths = find_misnamed_config_paths
      @user_config = load_user_config
      @config = deep_merge(DEFAULTS, @user_config)

      warn_about_misnamed_config_files
      warn_about_missing_framework
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

    #: () -> String
    def framework
      value = @config["framework"] || "ruby"

      unless VALID_FRAMEWORKS.include?(value)
        warn "[Herb] Unknown framework: #{value.inspect}. Valid values: #{VALID_FRAMEWORKS.join(", ")}. Defaulting to 'ruby'."
        return "ruby"
      end

      value
    end

    #: () -> bool
    def framework_configured?
      @user_config.key?("framework")
    end

    #: () -> Hash[Symbol, String]?
    def detected_framework
      return @detected_framework if defined?(@detected_framework)

      @detected_framework = detect_framework_from_gemfile
    end

    #: (?Hash[Symbol, String]?) -> String
    def missing_framework_warning(detection = detected_framework)
      prefix = if @config_path
                 "[Herb] No `framework` set in #{@config_path}, Herb assumes plain `ruby` templates."
               else
                 "[Herb] No `framework` set, Herb assumes plain `ruby` templates."
               end

      if detection
        gemfile = File.basename(detection[:gemfile_path])
        description = FRAMEWORK_DESCRIPTIONS[detection[:framework]]

        return "#{prefix} Your #{gemfile} depends on `#{detection[:gem]}`, so set `framework: #{detection[:framework]}` " \
               "and Herb can tailor its assumptions, rules, and optimizations to #{description}."
      end

      frameworks = VALID_FRAMEWORKS.map { |framework| "`#{framework}`" }
      last = frameworks.pop
      list = "#{frameworks.join(", ")}, or #{last}"

      "#{prefix} Set `framework` to one of #{list} so Herb can tailor its assumptions, rules, and optimizations " \
        "to your framework."
    end

    #: () -> String
    def template_engine
      value = @config["template_engine"] || "erubi"

      unless VALID_TEMPLATE_ENGINES.include?(value)
        warn "[Herb] Unknown template_engine: #{value.inspect}. Valid values: #{VALID_TEMPLATE_ENGINES.join(", ")}. Defaulting to 'erubi'."
        return "erubi"
      end

      value
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

    def engine
      @config["engine"] || {}
    end

    #: (String, untyped) -> untyped
    def engine_option(key, default = nil)
      engine.fetch(key.to_s, default)
    end

    def enabled_validators(overrides = {})
      config = dig("engine", "validators") || {}

      {
        security: config.fetch("security", true),
        nesting: config.fetch("nesting", true),
        accessibility: config.fetch("accessibility", true),
      }.merge(
        overrides.to_h { |key, value| [key.to_sym, !!value] }
      )
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

      #: () -> Array[String]
      def warned_framework_paths
        @warned_framework_paths ||= []
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

    def find_misnamed_config_paths
      search_path = @project_root || @start_path
      search_path = search_path.parent if search_path.file?

      MISNAMED_CONFIG_FILENAMES.map { |filename| search_path / filename }.select(&:exist?)
    end

    def warn_about_misnamed_config_files
      @misnamed_config_paths.each do |misnamed_path|
        warn "[Herb] Ignoring #{misnamed_path}: Herb only reads `#{CONFIG_FILENAMES.first}`. " \
             "Rename it to `#{CONFIG_FILENAMES.first}` to apply it."
      end
    end

    def warn_about_missing_framework
      return if framework_configured?

      project = (@config_path || @project_root || @start_path).to_s

      return if self.class.warned_framework_paths.include?(project)

      self.class.warned_framework_paths << project

      warn missing_framework_warning
    end

    #: () -> Hash[Symbol, String]?
    def detect_framework_from_gemfile
      search_path = @project_root || @start_path

      GEMFILE_FILENAMES.each do |gemfile_name|
        gemfile = search_path / gemfile_name

        return framework_from_gemfile(gemfile) if gemfile.exist?
      end

      nil
    end

    #: (Pathname) -> Hash[Symbol, String]?
    def framework_from_gemfile(gemfile)
      frameworks = {} #: Hash[String, String]

      gems_from_gemfile(gemfile.read).each do |gem_name|
        framework = FRAMEWORK_GEMS[gem_name]

        frameworks[framework] ||= gem_name if framework
      end

      framework = FRAMEWORK_PRECEDENCE.find { |candidate| frameworks.key?(candidate) }

      return nil unless framework

      { framework: framework, gem: frameworks[framework], gemfile_path: gemfile.to_s }
    end

    #: (String) -> Array[String]
    def gems_from_gemfile(source)
      program = Herb.parse_ruby(source).value

      return [] unless program

      gems = [] #: Array[String]

      collect_gems(program, gems)

      gems
    rescue StandardError
      []
    end

    #: (untyped, Array[String]) -> void
    def collect_gems(node, gems)
      gem_name = gem_call_name(node)

      gems << gem_name if gem_name

      node.child_nodes.each do |child|
        collect_gems(child, gems) if child
      end
    end

    #: (untyped) -> String?
    def gem_call_name(node)
      return nil unless node.is_a?(Prism::CallNode) && node.name == :gem && node.receiver.nil?

      argument = node.arguments&.arguments&.first

      return nil unless argument.is_a?(Prism::StringNode) || argument.is_a?(Prism::SymbolNode)

      argument.unescaped
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

    def load_user_config
      return {} unless @config_path&.exist?

      begin
        YAML.safe_load_file(@config_path, permitted_classes: [Symbol], aliases: true) || {}
      rescue Psych::SyntaxError => e
        warn "Warning: Invalid YAML in #{@config_path}: #{e.message}"

        {}
      end
    end

    def deep_merge(base, override, additive_keys: ["include", "exclude"])
      base.merge(override) do |key, old_value, new_value|
        if old_value.is_a?(Hash) && new_value.is_a?(Hash)
          deep_merge(old_value, new_value, additive_keys: additive_keys)
        elsif old_value.is_a?(Array) && new_value.is_a?(Array) && additive_keys.include?(key)
          old_value + new_value
        else
          new_value
        end
      end
    end
  end
end
