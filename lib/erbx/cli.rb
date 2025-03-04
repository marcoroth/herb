# frozen_string_literal: true

require "optparse"

class ERBX::CLI
  attr_accessor :json, :silent

  def initialize(args)
    @args = args
    @command = args[0]
    @file = args[1]
  end

  def call
    options

    if !result || result.failed?
      puts "Failed"
      exit(1)
    end

    if silent
      puts "Success"
    elsif json
      puts result.value.to_json
    else
      puts result.value.inspect
    end
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
      puts "Usage: bundle exec erbx #{@command} [file] [options]"
      exit(1)
    end
  end

  def help(exit_code = 0)
    message = <<~HELP
      ▗▄▄▄▖▗▄▄▖ ▗▄▄▖ ▗▖  ▗▖
      ▐▌   ▐▌ ▐▌▐▌ ▐▌ ▝▚▞▘
      ▐▛▀▀▘▐▛▀▚▖▐▛▀▚▖  ▐▌
      ▐▙▄▄▖▐▌ ▐▌▐▙▄▞▘▗▞▘▝▚▖

      ERBX - Seamless and powerful HTML+ERB parsing.

      Usage:
        bundle exec erbx [command] [options]

      Commands:
        bundle exec erbx lex [file]      Lex a file.
        bundle exec erbx parse [file]    Parse a file.
        bundle exec erbx analyze [path]  Analyze a project by passing a directory to the root of the project
        bundle exec erbx ruby [file]     Extract Ruby from a file.
        bundle exec erbx html [file]     Extract HTML from a file.
        bundle exec erbx prism [file]    Extract Ruby from a file and parse the Ruby source with Prism.
        bundle exec erbx version         Prints the versions of the ERBX gem and the liberbx library.

      Options:
        #{option_parser.to_s.strip.gsub(/^    /, "  ")}

    HELP

    puts message

    exit(exit_code)
  end

  def result
    @result ||= case @command
                when "analyze"
                  ERBX::Project.new(@file).parse!
                  exit(0)
                when "parse"
                  ERBX.parse(file_content)
                when "lex"
                  ERBX.lex(file_content)
                when "ruby"
                  puts ERBX.extract_ruby(file_content)
                  exit(0)
                when "html"
                  puts ERBX.extract_html(file_content)
                  exit(0)
                when "help", "-h", "--help"
                  help
                when "version", "-v", "--version"
                  puts ERBX.version
                  exit(0)
                when String
                  puts "Unkown command: '#{@command}'"
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
