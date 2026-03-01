# frozen_string_literal: true
# typed: ignore

# rbs_inline: disabled

require "optparse"

class Herb::CLI
  include Herb::Colors

  attr_accessor :json, :silent, :no_interactive, :no_log_file, :no_timing, :local, :escape, :no_escape, :freeze, :debug, :tool, :strict

  def initialize(args)
    @args = args
    @command = args[0]
  end

  def call
    options
    @file = @args[1]

    if silent
      if result.failed?
        puts "Failed"
      else
        puts "Success"
      end
    elsif json
      puts result.value.to_json
    else
      puts result.value.inspect

      print_error_summary(result.errors) if @command == "parse" && result.respond_to?(:errors) && result.errors.any?
    end
  end

  def directory
    unless @file
      puts "No directory provided."
      puts
      puts "Usage:"
      puts "  bundle exec herb #{@command} [directory] [options]"
      puts
      puts "Tip: Use `.` for the current directory"
      puts "  bundle exec herb #{@command} . [options]"

      exit(1)
    end

    unless File.exist?(@file)
      puts "Not a file: '#{@file}'."
      puts
    end

    unless File.directory?(@file)
      puts "Not a directory: '#{@file}'."
      puts
    end

    @file
  end

  def file_content
    if @file && @file != "-" && File.exist?(@file)
      File.read(@file)
    elsif @file && @file != "-"
      puts "File doesn't exist: #{@file}"
      exit(1)
    elsif @file == "-" || !$stdin.tty?
      $stdin.read
    else
      puts "No file provided."
      puts
      puts "Usage:"
      puts "  bundle exec herb #{@command} [file] [options]"
      puts
      puts "You can also pipe content via stdin:"
      puts "  echo \"<div>Hello</div>\" | bundle exec herb #{@command}"
      puts "  cat file.html.erb | bundle exec herb #{@command}"
      puts "  bundle exec herb #{@command} -"
      exit(1)
    end
  end

  def help(exit_code = 0)
    message = <<~HELP
      ▗▖ ▗▖▗▄▄▄▖▗▄▄▖ ▗▄▄▖
      ▐▌ ▐▌▐▌   ▐▌ ▐▌▐▌ ▐▌
      ▐▛▀▜▌▐▛▀▀▘▐▛▀▚▖▐▛▀▚▖
      ▐▌ ▐▌▐▙▄▄▖▐▌ ▐▌▐▙▄▞▘

      Herb 🌿 Powerful and seamless HTML-aware ERB parsing and tooling.

      Usage:
        bundle exec herb [command] [options]

      Commands:
        bundle exec herb lex [file]           Lex a file.
        bundle exec herb parse [file]         Parse a file.
        bundle exec herb compile [file]       Compile ERB template to Ruby code.
        bundle exec herb render [file]        Compile and render ERB template to final output.
        bundle exec herb analyze [path]       Analyze a project by passing a directory to the root of the project
        bundle exec herb config [path]        Show configuration and file patterns for a project
        bundle exec herb ruby [file]          Extract Ruby from a file.
        bundle exec herb html [file]          Extract HTML from a file.
        bundle exec herb playground [file]    Open the content of the source file in the playground
        bundle exec herb version              Prints the versions of the Herb gem and the libherb library.

        bundle exec herb lint [patterns]      Lint templates (delegates to @herb-tools/linter)
        bundle exec herb format [patterns]    Format templates (delegates to @herb-tools/formatter)
        bundle exec herb highlight [file]     Syntax highlight templates (delegates to @herb-tools/highlighter)
        bundle exec herb print [file]         Print AST (delegates to @herb-tools/printer)
        bundle exec herb lsp                  Start the language server (delegates to @herb-tools/language-server)

      stdin:
        Commands that accept [file] also accept input via stdin:
          echo "<div>Hello</div>" | bundle exec herb lex
          cat file.html.erb | bundle exec herb parse

        Use `-` to explicitly read from stdin:
          bundle exec herb compile -

      Options:
        #{option_parser.to_s.strip.gsub(/^    /, "  ")}

    HELP

    puts message

    exit(exit_code)
  end

  def result
    @result ||= case @command
                when "analyze"
                  project = Herb::Project.new(directory)
                  project.no_interactive = no_interactive
                  project.no_log_file = no_log_file
                  project.no_timing = no_timing
                  project.silent = silent
                  has_issues = project.parse!
                  exit(has_issues ? 1 : 0)
                when "config"
                  show_config
                  exit(0)
                when "parse"
                  Herb.parse(file_content, strict: strict.nil? || strict)
                when "compile"
                  compile_template
                when "render"
                  render_template
                when "lex"
                  Herb.lex(file_content)
                when "ruby"
                  puts Herb.extract_ruby(file_content)
                  exit(0)
                when "html"
                  puts Herb.extract_html(file_content)
                  exit(0)
                when "playground"
                  require "lz_string"

                  hash = LZString::UriSafe.compress(file_content)
                  local_url = "http://localhost:5173"
                  url = "https://herb-tools.dev/playground"

                  if local
                    if Dir.pwd.include?("/herb")
                      system(%(npx concurrently "nx dev playground" "sleep 1 && open #{local_url}##{hash}"))
                      exit(0)
                    else
                      puts "This command can currently only be run within the herb repo itself"
                      exit(1)
                    end
                  else
                    system(%(open "#{url}##{hash}"))
                    exit(0)
                  end
                when "lint"
                  run_node_tool("herb-lint", "@herb-tools/linter")
                when "format"
                  run_node_tool("herb-format", "@herb-tools/formatter")
                when "print"
                  run_node_tool("herb-print", "@herb-tools/printer")
                when "highlight"
                  run_node_tool("herb-highlight", "@herb-tools/highlighter")
                when "lsp"
                  run_node_tool("herb-language-server", "@herb-tools/language-server")
                when "help"
                  help
                when "version"
                  print_version
                when String
                  puts "Unknown command: '#{@command}'"
                  puts

                  help(1)
                else
                  help(1)
                end
  end

  def option_parser
    @option_parser ||= OptionParser.new do |parser|
      parser.banner = ""

      parser.on_tail("-v", "--version", "Show the version") do
        print_version
      end

      parser.on_tail("-h", "--help", "Show this message") do
        help
        exit(0)
      end

      parser.on("-j", "--json", "Return result in the JSON format") do
        self.json = true
      end

      parser.on("-s", "--silent", "Log no result to stdout") do
        self.silent = true
      end

      parser.on("-n", "--non-interactive", "Disable interactive output (progress bars, terminal clearing)") do
        self.no_interactive = true
      end

      parser.on("--no-log-file", "Disable log file generation") do
        self.no_log_file = true
      end

      parser.on("--no-timing", "Disable timing output") do
        self.no_timing = true
      end

      parser.on("--local", "Use localhost for playground command instead of herb-tools.dev") do
        self.local = true
      end

      parser.on("--escape", "Enable HTML escaping by default (for compile command)") do
        self.escape = true
      end

      parser.on("--no-escape", "Disable HTML escaping by default (for compile command)") do
        self.no_escape = true
      end

      parser.on("--freeze", "Add frozen string literal pragma (for compile command)") do
        self.freeze = true
      end

      parser.on("--debug", "Enable debug mode with ERB expression wrapping (for compile command)") do
        self.debug = true
      end

      parser.on("--strict", "Enable strict mode - report errors for omitted closing tags (for parse/compile/render commands) (default: true)") do
        self.strict = true
      end

      parser.on("--no-strict", "Disable strict mode (for parse/compile/render commands)") do
        self.strict = false
      end

      parser.on("--tool TOOL", "Show config for specific tool: linter, formatter (for config command)") do |t|
        self.tool = t.to_sym
      end
    end
  end

  def options
    return if ["lint", "format", "print", "highlight", "lsp"].include?(@command)

    option_parser.parse!(@args)
  end

  private

  def find_node_binary(name)
    local_bin = File.join(Dir.pwd, "node_modules", ".bin", name)
    return local_bin if File.executable?(local_bin)

    path_result = `which #{name} 2>/dev/null`.strip
    return path_result unless path_result.empty?

    nil
  end

  def node_available?
    system("which node > /dev/null 2>&1")
  end

  def run_node_tool(binary_name, package_name)
    unless node_available?
      warn "Error: Node.js is required to run 'herb #{@command}'."
      warn ""
      warn "Install the tool:"
      warn "  npm install #{package_name}"
      warn "  yarn add #{package_name}"
      warn "  pnpm add #{package_name}"
      warn "  bun add #{package_name}"
      warn ""
      warn "Or install Node.js from https://nodejs.org"
      exit 1
    end

    remaining_args = @args[1..]
    binary = find_node_binary(binary_name)
    node_version = `node --version 2>/dev/null`.strip

    command_parts = if binary
                      [binary, *remaining_args]
                    else
                      ["npx", package_name, *remaining_args]
                    end

    escaped_command = command_parts.map { |arg| arg.include?(" ") ? "\"#{arg}\"" : arg }.join(" ")

    warn "Node.js: #{node_version}"
    warn "Running: #{escaped_command}"
    warn ""

    exec(*command_parts)
  end

  def print_error_summary(errors)
    puts
    puts white("#{bold(red("Errors"))} #{dimmed("(#{errors.size} total)")}")
    puts

    errors.each_with_index do |error, index|
      error_type = error.error_name
      error_location = format_location_for_copy(error.location)
      error_message = error.message

      puts white("  #{bold("#{index + 1}.")} #{bold(red(error_type))} #{dimmed("at #{error_location}")}")
      puts white("     #{error_message}")
      puts unless index == errors.size - 1
    end
  end

  def format_location_for_copy(location)
    line = location.start.line
    column = location.start.column

    if @file
      "#{@file}:#{line}:#{column}"
    else
      "#{line}:#{column}"
    end
  end

  def compile_template
    require_relative "engine"

    begin
      options = {}
      options[:filename] = @file if @file
      options[:escape] = no_escape ? false : true
      options[:freeze] = true if freeze
      options[:strict] = strict.nil? || strict

      if debug
        options[:debug] = true
        options[:debug_filename] = @file if @file
      end

      engine = Herb::Engine.new(file_content, options)

      if json
        result = {
          success: true,
          source: engine.src,
          filename: engine.filename,
          bufvar: engine.bufvar,
          strict: options[:strict],
        }

        puts result.to_json
      elsif silent
        puts "Success"
      else
        puts engine.src
      end

      exit(0)
    rescue Herb::Engine::CompilationError => e
      if json
        result = {
          success: false,
          error: e.message,
          filename: @file,
        }
        puts result.to_json
      elsif silent
        puts "Failed"
      else
        puts e.message
      end

      exit(1)
    rescue StandardError => e
      if json
        result = {
          success: false,
          error: "Unexpected error: #{e.class}: #{e.message}",
          filename: @file,
        }
        puts result.to_json
      elsif silent
        puts "Failed"
      else
        puts "Unexpected error: #{e.class}: #{e.message}"
        puts e.backtrace.first(5).join("\n") unless silent
      end

      exit(1)
    end
  end

  def render_template
    require_relative "engine"

    begin
      options = {}
      options[:filename] = @file if @file
      options[:escape] = no_escape ? false : true
      options[:freeze] = true if freeze
      options[:strict] = strict.nil? || strict

      if debug
        options[:debug] = true
        options[:debug_filename] = @file if @file
      end

      engine = Herb::Engine.new(file_content, options)
      compiled_code = engine.src

      rendered_output = eval(compiled_code)

      if json
        result = {
          success: true,
          output: rendered_output,
          filename: engine.filename,
          strict: options[:strict],
        }

        puts result.to_json
      elsif silent
        puts "Success"
      else
        puts rendered_output
      end

      exit(0)
    rescue Herb::Engine::CompilationError => e
      if json
        result = {
          success: false,
          error: e.message,
          filename: @file,
        }
        puts result.to_json
      elsif silent
        puts "Failed"
      else
        puts e.message
      end

      exit(1)
    rescue StandardError => e
      if json
        result = {
          success: false,
          error: "Unexpected error: #{e.class}: #{e.message}",
          filename: @file,
        }
        puts result.to_json
      elsif silent
        puts "Failed"
      else
        puts "Unexpected error: #{e.class}: #{e.message}"
        puts e.backtrace.first(5).join("\n") unless silent
      end

      exit(1)
    end
  end

  def show_config
    path = @file || "."
    config = Herb::Configuration.load(path)

    if tool
      show_tool_config(config, path)
    else
      show_general_config(config, path)
    end
  end

  def show_general_config(config, path)
    puts bold("Herb Configuration")
    puts
    puts "#{bold("Project root:")} #{config.project_root || "(not found)"}"
    puts "#{bold("Config file:")}  #{config.config_path || "(using defaults)"}"
    puts

    puts bold("Include patterns:")
    config.file_include_patterns.each { |p| puts "  #{green("+")} #{p}" }
    puts

    puts bold("Exclude patterns:")
    config.file_exclude_patterns.each { |p| puts "  #{red("-")} #{p}" }
    puts

    all_matched = find_all_matching_files(path, config.file_include_patterns)
    included_files = config.find_files(path)
    excluded_files = all_matched - included_files

    puts bold("Files (#{included_files.size} included, #{excluded_files.size} excluded):")
    puts

    show_file_lists(included_files, excluded_files, path, config.file_exclude_patterns)

    puts
    puts dimmed("Tip: Use --tool linter or --tool formatter to see tool-specific configuration")
  end

  def show_tool_config(config, path)
    unless [:linter, :formatter].include?(tool)
      puts red("Unknown tool: #{tool}")
      puts "Valid tools: linter, formatter"
      exit(1)
    end

    tool_config = config.send(tool)
    include_patterns = config.include_patterns_for(tool)
    exclude_patterns = config.exclude_patterns_for(tool)

    puts bold("Herb Configuration for #{tool.to_s.capitalize}")
    puts
    puts "#{bold("Project root:")} #{config.project_root || "(not found)"}"
    puts "#{bold("Config file:")}  #{config.config_path || "(using defaults)"}"
    puts

    if tool_config["enabled"] == false
      puts yellow("⚠ #{tool.to_s.capitalize} is disabled in configuration")
      puts
    end

    puts bold("Include patterns (files + #{tool}):")
    include_patterns.each { |p| puts "  #{green("+")} #{p}" }
    puts

    puts bold("Exclude patterns (files + #{tool}):")
    exclude_patterns.each { |p| puts "  #{red("-")} #{p}" }
    puts

    all_matched = find_all_matching_files(path, include_patterns)
    included_files = config.find_files_for_tool(tool, path)
    excluded_files = all_matched - included_files

    puts bold("Files for #{tool} (#{included_files.size} included, #{excluded_files.size} excluded):")
    puts

    show_file_lists(included_files, excluded_files, path, exclude_patterns)
  end

  def show_file_lists(included_files, excluded_files, path, exclude_patterns)
    expanded_path = File.expand_path(path)

    if included_files.any?
      puts "  #{bold(green("Included:"))}"
      included_files.each do |f|
        relative = f.sub("#{expanded_path}/", "")
        puts "    #{green("✓")} #{relative}"
      end
      puts
    end

    return unless excluded_files.any?

    puts "  #{bold(red("Excluded:"))}"
    excluded_files.each do |f|
      relative = f.sub("#{expanded_path}/", "")
      reason = find_exclude_reason(relative, exclude_patterns)
      puts "    #{red("✗")} #{relative} #{dimmed("(#{reason})")}"
    end
  end

  def find_all_matching_files(path, include_patterns)
    expanded_path = File.expand_path(path)
    include_patterns.flat_map do |pattern|
      Dir[File.join(expanded_path, pattern)]
    end.uniq
  end

  def find_exclude_reason(relative_path, exclude_patterns)
    exclude_patterns.find do |pattern|
      File.fnmatch?(pattern, relative_path, File::FNM_PATHNAME)
    end || "excluded"
  end

  def print_version
    puts Herb.version
    exit(0)
  end
end
