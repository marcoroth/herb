# frozen_string_literal: true

require "optparse"
require_relative "erbx"

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
    if File.exist?(@file)
      File.read(@file)
    else
      puts "File doesn't exist: #{@file}"
      exit(1)
    end
  end

  def result
    @result ||= case @command
                when "analyze_project"
                  ERBX::Project.new(@file).parse!
                  exit(0)
                when "parse"
                  ERBX.parse(file_content)
                when "lex"
                  ERBX.lex(file_content)
                else
                  puts "Unkown command: '#{@command}'"
                  exit(1)
                end
  end

  def options
    option_parser = OptionParser.new do |parser|
      parser.banner = "Usage: bundle exec erbx [command] [file] [options]"

      parser.on_tail("-h", "--help", "Show this message") do
        puts parser
        exit
      end

      parser.on("-j", "--json", "Return result in the JSON format") do
        self.json = true
      end

      parser.on("-s", "--silent", "Log no result to stdout") do
        self.silent = true
      end
    end

    option_parser.parse!(@args)
  end
end
