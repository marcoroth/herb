# frozen_string_literal: true
# typed: ignore

# rbs_inline: disabled

require "optparse"

class Herb::CLI
  attr_accessor :json, :silent, :no_interactive, :no_log_file, :no_timing, :local, :escape, :no_escape, :freeze, :debug

  def initialize(args)
    @args = args
    @command = args[0]
    @file = args[1]
  end

  def call
    options

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
    if @file && File.exist?(@file)
      File.read(@file)
    elsif @file
      puts "File doesn't exist: #{@file}"
      exit(1)
    else
      puts "No file provided."
      puts
      puts "Usage:"
      puts "  bundle exec herb #{@command} [file] [options]"
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
        bundle exec herb lex [file]         Lex a file.
        bundle exec herb parse [file]       Parse a file.
        bundle exec herb compile [file]     Compile ERB template to Ruby code.
        bundle exec herb render [file]      Compile and render ERB template to final output.
        bundle exec herb analyze [path]     Analyze a project by passing a directory to the root of the project
        bundle exec herb ruby [file]        Extract Ruby from a file.
        bundle exec herb html [file]        Extract HTML from a file.
        bundle exec herb prism [file]       Extract Ruby from a file and parse the Ruby source with Prism.
        bundle exec herb playground [file]  Open the content of the source file in the playground
        bundle exec herb version            Prints the versions of the Herb gem and the libherb library.

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
                when "parse"
                  Herb.parse(file_content)
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
    end
  end

  def options
    option_parser.parse!(@args)
  end

  private

  def compile_template
    require_relative "engine"

    begin
      options = {}
      options[:filename] = @file if @file
      options[:escape] = no_escape ? false : true
      options[:freeze] = true if freeze

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

  def print_version
    puts Herb.version
    exit(0)
  end
end
