# frozen_string_literal: true

require "io/console"
require "timeout"
require "tempfile"
require "pathname"
require "English"

module ERBX
  class Project
    attr_accessor :project_path, :output_file

    def initialize(project_path, output_file: nil)
      @project_path = Pathname.new(project_path || __dir__)

      date = Time.now.strftime("%Y-%m-%d_%H-%M-%S")
      @output_file = output_file || "#{date}_erb_parsing_result_#{@project_path.basename}.log"
    end

    def glob
      "**/*.html.erb"
    end

    def absolute_path
      File.expand_path(@project_path, __dir__)
    end

    def progress_bar(current, total, width = IO.console.winsize[1] - "[] 100% (#{total}/#{total})".length)
      progress = current.to_f / total
      completed_length = (progress * width).to_i
      completed = "█" * completed_length

      partial_index = ((progress * width) % 1 * 8).to_i
      partial_chars = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"]
      partial = partial_index.zero? ? "" : partial_chars[partial_index]

      remaining = " " * (width - completed_length - (partial.empty? ? 0 : 1))
      percentage = (progress * 100).to_i

      # Format as [███████▋       ] 42% (123/292)
      "[#{completed}#{partial}#{remaining}] #{percentage}% (#{current}/#{total})"
    end

    def heading(text)
      prefix = "--- #{text.upcase} "

      prefix + ("-" * (80 - prefix.length))
    end

    def parse!
      File.open(output_file, "w") do |log|
        log.puts heading("METADATA")
        log.puts "ERBX Version: #{ERBX::VERSION}"
        log.puts "Reported at: #{Time.now.strftime("%Y-%m-%dT%H:%M:%S")}\n\n"

        log.puts heading("PROJECT")
        log.puts "Path: #{absolute_path}"
        log.puts "Glob: #{"#{absolute_path}#{glob}"}\n\n"

        log.puts heading("PROCESSED FILES")

        files = Dir["#{project_path}#{glob}"]

        if files.empty?
          message = "No .html.erb files found in #{absolute_path}"
          log.puts message
          puts message
          next
        end

        print "\e[H\e[2J"

        successful_files = []
        failed_files = []
        timeout_files = []
        error_files = []
        error_outputs = {}
        file_contents = {}
        parse_errors = {}

        files.each_with_index do |file_path, index|
          total_failed = failed_files.count
          total_timeout = timeout_files.count
          total_errors = error_files.count

          lines_to_clear = 6 + total_failed + total_timeout + total_errors
          lines_to_clear += 3 if total_failed.positive?
          lines_to_clear += 3 if total_timeout.positive?
          lines_to_clear += 3 if total_errors.positive?

          lines_to_clear.times { print "\e[1A\e[K" } if index.positive?

          puts "Parsing .html.erb files in: #{project_path}"
          puts "Total files to process: #{files.count}\n"

          relative_path = file_path.sub("#{project_path}/", "")

          puts
          puts progress_bar(index + 1, files.count)
          puts
          puts "Processing [#{index + 1}/#{files.count}]: #{relative_path}"

          if failed_files.any?
            puts
            puts "Files that failed:"
            failed_files.each { |file| puts "  - #{file}" }
            puts
          end

          if timeout_files.any?
            puts
            puts "Files that timed out:"
            timeout_files.each { |file| puts "  - #{file}" }
            puts
          end

          if error_files.any?
            puts
            puts "Files with parse errors:"
            error_files.each { |file| puts "  - #{file}" }
            puts
          end

          begin
            file_content = File.read(file_path)

            stdout_file = Tempfile.new("stdout")
            stderr_file = Tempfile.new("stderr")
            ast_file = Tempfile.new("ast")

            Timeout.timeout(1) do
              pid = Process.fork do
                $stdout.reopen(stdout_file.path, "w")
                $stderr.reopen(stderr_file.path, "w")

                begin
                  result = ERBX.parse(file_content)

                  if result.failed?
                    File.open(ast_file.path, "w") do |f|
                      f.puts result.value.inspect
                    end

                    exit!(2)
                  end

                  exit!(0)
                rescue StandardError => e
                  warn "Ruby exception: #{e.class}: #{e.message}"
                  warn e.backtrace.join("\n") if e.backtrace
                  exit!(1)
                end
              end

              Process.waitpid(pid)

              stdout_file.rewind
              stderr_file.rewind
              stdout_content = stdout_file.read
              stderr_content = stderr_file.read
              ast = File.exist?(ast_file.path) ? File.read(ast_file.path) : ""

              case $CHILD_STATUS.exitstatus
              when 0
                log.puts "✅ Parsed #{file_path} successfully"
                successful_files << file_path
              when 2
                message = "⚠️ Parsing #{file_path} completed with errors"
                log.puts message

                parse_errors[file_path] = {
                  ast: ast,
                  stdout: stdout_content,
                  stderr: stderr_content
                }

                file_contents[file_path] = file_content

                error_files << file_path
              else
                message = "❌ Parsing #{file_path} failed"
                log.puts message
                puts "\n#{message}"

                error_outputs[file_path] = {
                  exit_code: $CHILD_STATUS.exitstatus,
                  stdout: stdout_content,
                  stderr: stderr_content
                }

                file_contents[file_path] = file_content

                failed_files << file_path
              end
            end

            stdout_file.close
            stdout_file.unlink
            stderr_file.close
            stderr_file.unlink
            ast_file.close
            ast_file.unlink
          rescue Timeout::Error
            message = "⏱️ Parsing #{file_path} timed out after 1 second"
            log.puts message
            puts "\n#{message}"

            begin
              Process.kill("TERM", pid)
            rescue StandardError
              nil
            end

            timeout_files << file_path
            file_contents[file_path] = file_content
          rescue StandardError => e
            message = "⚠️ Error processing #{file_path}: #{e.message}"
            log.puts message
            puts "\n#{message}"
            failed_files << file_path
            begin
              file_contents[file_path] = File.read(file_path)
            rescue StandardError => read_error
              log.puts "    Could not read file content: #{read_error.message}"
            end
          end
        end

        print "\e[1A\e[K"
        puts "Completed processing all files."

        print "\e[H\e[2J"

        log.puts ""

        summary = [
          heading("Summary"),
          "Total files: #{files.count}",
          "✅ Successful: #{successful_files.count}",
          "❌ Failed: #{failed_files.count}",
          "⚠️ Parse errors: #{error_files.count}",
          "⏱️ Timed out: #{timeout_files.count}"
        ]

        summary.each do |line|
          log.puts line
          puts line
        end

        if failed_files.any?
          log.puts "\n#{heading("Files that failed")}"
          puts "\nFiles that failed:"

          failed_files.each do |f|
            log.puts "- #{f}"
            puts "  - #{f}"
          end
        end

        if error_files.any?
          log.puts "\n#{heading("Files with parse errors")}"
          puts "\nFiles with parse errors:"

          error_files.each do |f|
            log.puts f
            puts "  - #{f}"
          end
        end

        if timeout_files.any?
          log.puts "\n#{heading("Files that timed out")}"
          puts "\nFiles that timed out:"

          timeout_files.each do |f|
            log.puts f
            puts "  - #{f}"
          end
        end

        problem_files = failed_files + timeout_files + error_files

        if problem_files.any?
          log.puts "\n#{heading("FILE CONTENTS AND DETAILS")}"

          problem_files.each do |file|
            next unless file_contents[file]

            divider = "=" * [80, file.length].max

            log.puts
            log.puts divider
            log.puts file
            log.puts divider

            log.puts "\n#{heading("CONTENT")}"
            log.puts "```erb"
            log.puts file_contents[file]
            log.puts "```"

            if error_outputs[file]
              if error_outputs[file][:exit_code]
                log.puts "\n#{heading("EXIT CODE")}"
                log.puts error_outputs[file][:exit_code]
              end

              if error_outputs[file][:stderr].strip.length.positive?
                log.puts "\n#{heading("ERROR OUTPUT")}"
                log.puts "```"
                log.puts error_outputs[file][:stderr]
                log.puts "```"
              end

              if error_outputs[file][:stdout].strip.length.positive?
                log.puts "\n#{heading("STANDARD OUTPUT")}"
                log.puts "```"
                log.puts error_outputs[file][:stdout]
                log.puts "```"
                log.puts
              end
            end

            next unless parse_errors[file]

            if parse_errors[file][:stdout].strip.length.positive?
              log.puts "\n#{heading("STANDARD OUTPUT")}"
              log.puts "```"
              log.puts parse_errors[file][:stdout]
              log.puts "```"
            end

            if parse_errors[file][:stderr].strip.length.positive?
              log.puts "\n#{heading("ERROR OUTPUT")}"
              log.puts "```"
              log.puts parse_errors[file][:stderr]
              log.puts "```"
            end

            next unless parse_errors[file][:ast]

            log.puts "\n#{heading("AST")}"
            log.puts "```"
            log.puts parse_errors[file][:ast]
            log.puts "```"
            log.puts
          end
        end

        puts "\nResults saved to #{output_file}"
      end
    end
  end
end
