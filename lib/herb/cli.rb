# frozen_string_literal: true

require "optparse"
require "lz_string"

class Herb::CLI
  attr_accessor :json, :silent

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
      puts "Not a directory: '#{@file}'."
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

      Herb 🌿 Powerful and seamless HTML-aware ERB parsing.

      Usage:
        bundle exec herb [command] [options]

      Commands:
        bundle exec herb lex [file]         Lex a file.
        bundle exec herb parse [file]       Parse a file.
        bundle exec herb analyze [path]     Analyze a project by passing a directory to the root of the project
        bundle exec herb ruby [file]        Extract Ruby from a file.
        bundle exec herb html [file]        Extract HTML from a file.
        bundle exec herb prism [file]       Extract Ruby from a file and parse the Ruby source with Prism.
        bundle exec herb format [file]      Format a HTML+ERB file.
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
                  Herb::Project.new(directory).parse!
                  exit(0)
                when "parse"
                  Herb.parse(file_content)
                when "lex"
                  Herb.lex(file_content)
                when "ruby"
                  puts Herb.extract_ruby(file_content)
                  exit(0)
                when "html"
                  puts Herb.extract_html(file_content)
                  exit(0)
                when "format"
                  puts Herb::Formatter.format_file!(@file)
                  exit(0)
                when "playground"
                  if Dir.pwd.include?("/herb")
                    system(%(npx concurrently "nx dev playground" "sleep 1 && open http://localhost:5173##{LZString::UriSafe.compress(file_content)}"))
                    exit(0)
                  else
                    puts "This command can currently only be run within the herb repo itself"
                    exit(1)
                  end
                when "help", "-h", "--help"
                  help
                when "version", "-v", "--version"
                  puts Herb.version
                  exit(0)
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
    end
  end

  def options
    option_parser.parse!(@args)
  end
end
