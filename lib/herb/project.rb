# frozen_string_literal: true
# typed: ignore
# rbs_inline: disabled

require "timeout"
require "tempfile"
require "pathname"
require "English"
require "stringio"

module Herb
  class Project
    include Colors

    attr_accessor :project_path, :output_file, :no_log_file, :no_timing, :silent, :verbose, :isolate, :validate_ruby, :file_paths

    # Known error types that indicate issues in the user's template, not bugs in the parser.
    TEMPLATE_ERRORS = [
      "MissingOpeningTagError",
      "MissingClosingTagError",
      "TagNamesMismatchError",
      "VoidElementClosingTagError",
      "UnclosedElementError",
      "RubyParseError",
      "ERBControlFlowScopeError",
      "MissingERBEndTagError",
      "ERBMultipleBlocksInTagError",
      "ERBCaseWithConditionsError",
      "ConditionalElementMultipleTagsError",
      "ConditionalElementConditionMismatchError",
      "InvalidCommentClosingTagError",
      "OmittedClosingTagError",
      "UnclosedOpenTagError",
      "UnclosedCloseTagError",
      "UnclosedQuoteError",
      "MissingAttributeValueError",
      "UnclosedERBTagError",
      "StrayERBClosingTagError",
      "NestedERBTagError"
    ].freeze

    ISSUE_TYPES = [
      { key: :failed, label: "Parser crashed", symbol: "✗", color: :red, reportable: true,
        hint: "This could be a bug in the parser. Reporting it helps us improve Herb for everyone.",
        file_hint: ->(relative) { "Run `herb parse #{relative}` to see the parser output." } },
      { key: :template_error, label: "Template errors", symbol: "✗", color: :red,
        hint: "These files have issues in the template. Review the errors and update your templates to fix them." },
      { key: :unexpected_error, label: "Unexpected parse errors", symbol: "✗", color: :red, reportable: true,
        hint: "These errors may indicate a bug in the parser. Reporting them helps us make Herb more robust.",
        file_hint: ->(relative) { "Run `herb parse #{relative}` to see the parser output." } },
      { key: :strict_parse_error, label: "Strict mode parse errors", symbol: "⚠", color: :yellow,
        hint: "These files use HTML patterns like omitted closing tags. Add explicit closing tags to fix." },
      { key: :analyze_parse_error, label: "Analyze parse errors", symbol: "⚠", color: :yellow,
        hint: "These files have issues detected during analysis. Review the errors and update your templates." },
      { key: :timeout, label: "Timed out", symbol: "⚠", color: :yellow, reportable: true,
        hint: "These files took too long to parse. This could indicate a parser issue. Reporting it helps us track down edge cases." },
      { key: :validation_error, label: "Validation errors", symbol: "⚠", color: :yellow,
        hint: "These templates have security, nesting, or accessibility issues. The templates compile fine otherwise. Review and fix these to improve your template structure." },
      { key: :compilation_failed, label: "Compilation errors", symbol: "✗", color: :red, reportable: true,
        hint: "These files could not be compiled to Ruby. This could be a bug in the engine. Reporting it helps us improve Herb's compatibility.",
        file_hint: ->(relative) { "Run `herb compile #{relative}` to see the compilation error." } },
      { key: :strict_compilation_failed, label: "Strict mode compilation errors", symbol: "⚠", color: :yellow,
        hint: "These files fail to compile only in strict mode. Add explicit closing tags to fix, or pass --no-strict to allow.",
        file_hint: ->(relative) { "Run `herb compile #{relative}` to see the compilation error." } },
      { key: :invalid_ruby, label: "Invalid Ruby output", symbol: "✗", color: :red, reportable: true,
        hint: "The engine produced Ruby code that doesn't parse. This is most likely a bug in the engine. Reporting it helps us fix it.",
        file_hint: ->(relative) { "Run `herb compile #{relative}` to see the compiled output." } }
    ].freeze

    class ResultTracker
      attr_reader :successful, :failed, :timeout, :template_error, :unexpected_error,
                  :strict_parse_error, :analyze_parse_error,
                  :validation_error, :compilation_failed, :strict_compilation_failed,
                  :invalid_ruby,
                  :error_outputs, :file_contents, :parse_errors, :compilation_errors,
                  :file_diagnostics

      def initialize
        @successful = []
        @failed = []
        @timeout = []
        @template_error = []
        @unexpected_error = []
        @strict_parse_error = []
        @analyze_parse_error = []
        @validation_error = []
        @compilation_failed = []
        @strict_compilation_failed = []
        @invalid_ruby = []
        @error_outputs = {}
        @file_contents = {}
        @parse_errors = {}
        @compilation_errors = {}
        @file_diagnostics = {}
      end

      def problem_files
        failed + timeout + template_error + unexpected_error + strict_parse_error + analyze_parse_error +
          validation_error + compilation_failed + strict_compilation_failed + invalid_ruby
      end

      def file_issue_type(file)
        ISSUE_TYPES.find { |type| send(type[:key]).include?(file) }
      end

      def diagnostic_counts
        counts = Hash.new { |hash, key| hash[key] = { count: 0, files: Set.new } }

        file_diagnostics.each do |file, diagnostics|
          diagnostics.each do |diagnostic|
            counts[diagnostic[:name]][:count] += 1
            counts[diagnostic[:name]][:files] << file
          end
        end

        counts.sort_by { |_name, value| -value[:count] }
      end
    end

    def initialize(project_path, output_file: nil)
      @project_path = Pathname.new(
        project_path ? File.expand_path(".", project_path) : File.expand_path("../..", __dir__)
      )

      date = Time.now.strftime("%Y-%m-%d_%H-%M-%S")
      @output_file = output_file || "#{date}_erb_parsing_result_#{@project_path.basename}.log"
    end

    def configuration
      @configuration ||= Configuration.load(@project_path.to_s)
    end

    def include_patterns
      configuration.file_include_patterns
    end

    def exclude_patterns
      configuration.file_exclude_patterns
    end

    def absolute_path
      File.expand_path(@project_path, File.expand_path("../..", __dir__))
    end

    def files
      @files ||= file_paths || find_files
    end

    private

    def find_files
      included = include_patterns.flat_map do |pattern|
        Dir[File.join(@project_path, pattern)]
      end.uniq

      return included if exclude_patterns.empty?

      included.reject do |file|
        relative_path = file.sub("#{@project_path}/", "")
        exclude_patterns.any? { |pattern| File.fnmatch?(pattern, relative_path, File::FNM_PATHNAME) }
      end
    end

    public

    def analyze!
      start_time = Time.now unless no_timing

      log = if no_log_file
              StringIO.new
            else
              File.open(output_file, "w")
            end

      begin
        log.puts heading("METADATA")
        log.puts "Herb Version: #{Herb.version}"
        log.puts "Reported at: #{Time.now.strftime("%Y-%m-%dT%H:%M:%S")}\n\n"

        log.puts heading("PROJECT")
        log.puts "Path: #{absolute_path}"
        log.puts "Config: #{configuration.config_path || "(defaults)"}"
        log.puts "Include: #{include_patterns.join(", ")}"
        log.puts "Exclude: #{exclude_patterns.join(", ")}\n\n"

        log.puts heading("PROCESSED FILES")

        if files.empty?
          message = "No files found matching patterns: #{include_patterns.join(", ")}"
          log.puts message
          puts message
          return
        end

        @results = ResultTracker.new
        results = @results

        unless silent
          puts ""
          puts "#{bold("Herb")} 🌿 #{dimmed("v#{Herb::VERSION}")}"
          puts ""

          if configuration.config_path
            puts "#{green("✓")} Using Herb config file at #{dimmed(configuration.config_path)}"
          else
            puts dimmed("No .herb.yml found, using defaults")
          end

          puts dimmed("Analyzing #{files.count} #{pluralize(files.count, "file")}...")
        end

        total_width = files.count.to_s.length

        finish_hook = lambda do |item, index, _file_result|
          next if silent

          if verbose
            relative_path = relative_path(item)
            puts "  #{dimmed("[#{(index + 1).to_s.rjust(total_width)}/#{files.count}]")} #{relative_path}"
          else
            print "."
          end
        end

        ensure_parallel!

        file_results = Parallel.map(files, in_processes: Parallel.processor_count, finish: finish_hook) do |file_path|
          process_file(file_path)
        end

        unless silent
          puts "" unless verbose
          puts ""
          puts separator
        end

        file_results.each do |result|
          merge_file_result(result, results, log)
        end

        log.puts ""

        duration = no_timing ? nil : Time.now - start_time

        print_file_lists(results, log)

        if results.problem_files.any?
          puts "\n #{separator}"
          print_issue_summary(results)

          if reportable_files?(results)
            puts "\n #{separator}"
            print_reportable_files(results)
          end
        end

        log_problem_file_details(results, log)

        unless no_log_file
          puts "\n #{separator}"
          puts "\n #{dimmed("Results saved to #{output_file}")}"
        end

        puts "\n #{separator}"
        print_summary(results, log, duration)

        results.problem_files.any?
      ensure
        log.close unless no_log_file
      end
    end

    def print_file_report(file_path)
      file_path = File.expand_path(file_path)
      results = @results

      unless results
        puts "No results available. Run parse! first."
        return
      end

      relative = relative_path(file_path)
      issue_type = results.file_issue_type(file_path)

      unless issue_type
        puts "No issues found for #{relative}."
        return
      end

      diagnostics = results.file_diagnostics[file_path]
      file_content = results.file_contents[file_path]

      puts "- **Herb:** `#{Herb.version}`"
      puts "- **Ruby:** `#{RUBY_VERSION}`"
      puts "- **Platform:** `#{RUBY_PLATFORM}`"
      puts "- **Category:** `#{issue_type[:label]}`"

      if diagnostics&.any?
        puts ""
        puts "**Errors:**"
        diagnostics.each do |diagnostic|
          lines = diagnostic[:message].split("\n")
          puts "- **#{diagnostic[:name]}** #{lines.first}"
          lines.drop(1).each do |line|
            puts "  #{line}"
          end
        end
      end

      if file_content
        puts ""
        puts "**Template:**"
        puts "```erb"
        puts file_content
        puts "```"
      end

      return unless issue_type[:key] == :invalid_ruby && file_content

      begin
        engine = Herb::Engine.new(file_content, filename: file_path, escape: true, validation_mode: :none)
        puts ""
        puts "**Compiled Ruby:**"
        puts "```ruby"
        puts engine.src
        puts "```"
      rescue StandardError
        # Skip if compilation fails entirely
      end
    end

    private

    def process_file(file_path)
      isolate ? process_file_isolated(file_path) : process_file_direct(file_path)
    end

    def process_file_direct(file_path)
      file_content = File.read(file_path)
      result = { file_path: file_path }

      Timeout.timeout(1) do
        parse_result = Herb.parse(file_content)

        if parse_result.failed?
          result[:file_content] = file_content
          result.merge!(classify_parse_errors(file_path, file_content))
        else
          result[:log] = "✅ Parsed #{file_path} successfully"
          result.merge!(compile_file(file_path, file_content))
        end
      end

      result
    rescue Timeout::Error
      { file_path: file_path, status: :timeout, file_content: file_content,
        log: "⏱️ Parsing #{file_path} timed out after 1 second" }
    rescue StandardError => e
      file_content ||= begin
        File.read(file_path)
      rescue StandardError
        nil
      end

      { file_path: file_path, status: :failed, file_content: file_content,
        log: "⚠️ Error processing #{file_path}: #{e.message}" }
    end

    def process_file_isolated(file_path)
      file_content = File.read(file_path)
      result = { file_path: file_path }

      stdout_file = Tempfile.new("stdout")
      stderr_file = Tempfile.new("stderr")

      Timeout.timeout(1) do
        pid = Process.fork do
          $stdout.reopen(stdout_file.path, "w")
          $stderr.reopen(stderr_file.path, "w")

          begin
            parse_result = Herb.parse(file_content)
            exit!(parse_result.failed? ? 2 : 0)
          rescue StandardError => e
            warn "Ruby exception: #{e.class}: #{e.message}"
            warn e.backtrace.join("\n") if e.backtrace
            exit!(1)
          end
        end

        Process.waitpid(pid)

        stderr_file.rewind
        stderr_content = stderr_file.read

        case $CHILD_STATUS.exitstatus
        when 0
          result[:log] = "✅ Parsed #{file_path} successfully"
          result.merge!(compile_file(file_path, file_content))
        when 2
          result[:file_content] = file_content
          result.merge!(classify_parse_errors(file_path, file_content))
        else
          result[:log] = "❌ Parsing #{file_path} failed"
          result[:status] = :failed
          result[:file_content] = file_content
          result[:error_output] = { exit_code: $CHILD_STATUS.exitstatus, stderr: stderr_content }
        end
      end

      result
    rescue Timeout::Error
      begin
        Process.kill("TERM", pid)
      rescue StandardError
        nil
      end

      { file_path: file_path, status: :timeout, file_content: file_content,
        log: "⏱️ Parsing #{file_path} timed out after 1 second" }
    rescue StandardError => e
      file_content ||= begin
        File.read(file_path)
      rescue StandardError
        nil
      end

      { file_path: file_path, status: :failed, file_content: file_content,
        log: "⚠️ Error processing #{file_path}: #{e.message}" }
    ensure
      [stdout_file, stderr_file].each do |tempfile|
        next unless tempfile

        tempfile.close
        tempfile.unlink
      end
    end

    def classify_parse_errors(file_path, file_content)
      default_result = Herb.parse(file_content)

      diagnostics = if default_result.respond_to?(:errors) && default_result.errors.any?
                      default_result.errors.map do |error|
                        diagnostic = { name: error.error_name, message: error.message }
                        if error.respond_to?(:location) && error.location
                          diagnostic[:line] = error.location.start.line
                          diagnostic[:column] = error.location.start.column
                        end
                        diagnostic
                      end
                    end

      no_strict_result = Herb.parse(file_content, strict: false)
      no_analyze_result = Herb.parse(file_content, analyze: false)

      if no_strict_result.success?
        { status: :strict_parse_error, diagnostics: diagnostics,
          log: "⚠️ Parsing #{file_path} completed with strict mode errors" }
      elsif no_analyze_result.success?
        { status: :analyze_parse_error, diagnostics: diagnostics,
          log: "⚠️ Parsing #{file_path} completed with analyze errors" }
      elsif diagnostics&.any? && diagnostics.all? { |diagnostic| TEMPLATE_ERRORS.include?(diagnostic[:name]) }
        { status: :template_error, diagnostics: diagnostics,
          log: "⚠️ Parsing #{file_path} completed with template errors" }
      else
        { status: :unexpected_error, diagnostics: diagnostics,
          log: "❌ Parsing #{file_path} completed with unexpected errors" }
      end
    end

    def compile_file(file_path, file_content)
      Herb::Engine.new(file_content, filename: file_path, escape: true, validate_ruby: validate_ruby)

      { status: :successful, log: "✅ Compiled #{file_path} successfully" }
    rescue Herb::Engine::InvalidRubyError => e
      { status: :invalid_ruby, file_content: file_content,
        compilation_error: { error: e.message, backtrace: e.backtrace&.first(10) || [] },
        diagnostics: [{ name: "InvalidRubyError", message: e.message }],
        log: "🚨 Compiled Ruby is invalid for #{file_path}" }
    rescue Herb::Engine::SecurityError, Herb::Engine::CompilationError => e
      compilation_error = { error: e.message, backtrace: e.backtrace&.first(10) || [] }

      # Retry without validators
      begin
        Herb::Engine.new(file_content, filename: file_path, escape: true, validation_mode: :none, validate_ruby: validate_ruby)
        error_name = e.is_a?(Herb::Engine::SecurityError) ? "SecurityError" : "ValidationError"
        return { status: :validation_error, file_content: file_content,
                 compilation_error: compilation_error,
                 diagnostics: [{ name: error_name, message: e.message }],
                 log: "⚠️ Compilation failed for #{file_path} (validation error)" }
      rescue StandardError
        # Not a validator-caused error, continue with other checks
      end

      # Retry without strict mode
      begin
        Herb::Engine.new(file_content, filename: file_path, escape: true, strict: false, validate_ruby: validate_ruby)
        return { status: :strict_compilation_failed, file_content: file_content,
                 compilation_error: compilation_error,
                 diagnostics: [{ name: "CompilationError", message: "#{e.message} (strict mode)" }],
                 log: "🔒 Compilation failed for #{file_path} (strict mode error)" }
      rescue StandardError
        # Fall through
      end

      { status: :compilation_failed, file_content: file_content,
        compilation_error: compilation_error,
        diagnostics: [{ name: "CompilationError", message: e.message }],
        log: "❌ Compilation failed for #{file_path}" }
    rescue StandardError => e
      { status: :compilation_failed, file_content: file_content,
        compilation_error: { error: "#{e.class}: #{e.message}", backtrace: e.backtrace&.first(10) || [] },
        diagnostics: [{ name: e.class.to_s, message: e.message }],
        log: "❌ Unexpected compilation error for #{file_path}: #{e.class}: #{e.message}" }
    end

    def merge_file_result(result, tracker, log)
      file_path = result[:file_path]
      status = result[:status]

      log.puts result[:log] if result[:log]

      return unless status

      tracker.send(status) << file_path

      tracker.file_contents[file_path] = result[:file_content] if result[:file_content]
      tracker.error_outputs[file_path] = result[:error_output] if result[:error_output]
      tracker.parse_errors[file_path] = result[:parse_error] if result[:parse_error]
      tracker.compilation_errors[file_path] = result[:compilation_error] if result[:compilation_error]
      tracker.file_diagnostics[file_path] = result[:diagnostics] if result[:diagnostics]&.any?
    end

    def print_summary(results, log, duration)
      total = files.count
      issues = results.problem_files.count
      passed = results.successful.count

      log_summary(results, log, total, duration)

      parsed = total - results.failed.count - results.timeout.count

      puts "\n"
      puts " #{bold("Summary:")}"

      puts "  #{label("Version")} #{cyan(Herb.version)}"
      puts "  #{label("Checked")} #{cyan("#{total} #{pluralize(total, "file")}")}"

      if total > 1
        files_line = if issues.positive?
                       "#{bold(green("#{passed} clean"))} | #{bold(red("#{issues} with issues"))}"
                     else
                       bold(green("#{total} clean"))
                     end

        puts "  #{label("Files")} #{files_line}"
      end

      parser_parts = []
      parser_parts << stat(parsed, "parsed", :green)
      parser_parts << stat(results.failed.count, "crashed", :red) if results.failed.any?
      parser_parts << stat(results.template_error.count, pluralize(results.template_error.count, "template error"), :red) if results.template_error.any?
      parser_parts << stat(results.unexpected_error.count, "unexpected", :red) if results.unexpected_error.any?
      parser_parts << stat(results.strict_parse_error.count, "strict", :yellow) if results.strict_parse_error.any?
      parser_parts << stat(results.analyze_parse_error.count, "analyze", :yellow) if results.analyze_parse_error.any?
      puts "  #{label("Parser")} #{parser_parts.join(" | ")}"

      skipped = total - passed - results.validation_error.count - results.compilation_failed.count -
                results.strict_compilation_failed.count - results.invalid_ruby.count

      engine_parts = []
      engine_parts << stat(passed, "compiled", :green)
      engine_parts << stat(results.validation_error.count, "validation", :yellow) if results.validation_error.any?
      engine_parts << stat(results.compilation_failed.count, "compilation", :red) if results.compilation_failed.any?
      engine_parts << stat(results.strict_compilation_failed.count, "strict", :yellow) if results.strict_compilation_failed.any?
      engine_parts << stat(results.invalid_ruby.count, "produced invalid Ruby", :red) if results.invalid_ruby.any?
      engine_parts << dimmed("#{skipped} skipped") if skipped.positive?
      puts "  #{label("Engine")} #{engine_parts.join(" | ")}"

      if results.timeout.any?
        puts "  #{label("Timeout")} #{stat(results.timeout.count, "timed out", :yellow)}"
      end

      if duration
        puts "  #{label("Duration")} #{cyan(format_duration(duration))}"
      end

      return unless issues.zero? && total > 1

      puts ""
      puts " #{bold(green("✓"))} #{green("All files are clean!")}"
    end

    def log_summary(results, log, total, duration)
      log.puts heading("Summary")
      log.puts "Herb Version: #{Herb.version}"
      log.puts "Total files: #{total}"
      log.puts "Parser options: strict: true, analyze: true"
      log.puts ""
      log.puts "✅ Successful (parsed & compiled): #{results.successful.count} (#{percentage(results.successful.count, total)}%)"
      log.puts ""
      log.puts "--- Parser ---"
      log.puts "❌ Parser crashed: #{results.failed.count} (#{percentage(results.failed.count, total)}%)"
      log.puts "⚠️ Template errors: #{results.template_error.count} (#{percentage(results.template_error.count, total)}%)"
      log.puts "❌ Unexpected parse errors: #{results.unexpected_error.count} (#{percentage(results.unexpected_error.count, total)}%)"
      log.puts "🔒 Strict mode parse errors (ok with strict: false): #{results.strict_parse_error.count} (#{percentage(results.strict_parse_error.count, total)}%)"
      log.puts "🔍 Analyze parse errors (ok with analyze: false): #{results.analyze_parse_error.count} (#{percentage(results.analyze_parse_error.count, total)}%)"
      log.puts ""
      log.puts "--- Engine ---"
      log.puts "⚠️ Validation errors (ok without validators): #{results.validation_error.count} (#{percentage(results.validation_error.count, total)}%)"
      log.puts "❌ Compilation errors: #{results.compilation_failed.count} (#{percentage(results.compilation_failed.count, total)}%)"
      log.puts "🔒 Strict mode compilation errors (ok with strict: false): #{results.strict_compilation_failed.count} (#{percentage(results.strict_compilation_failed.count, total)}%)"
      log.puts "🚨 Invalid Ruby output: #{results.invalid_ruby.count} (#{percentage(results.invalid_ruby.count, total)}%)"
      log.puts ""
      log.puts "--- Other ---"
      log.puts "⏱️ Timed out: #{results.timeout.count} (#{percentage(results.timeout.count, total)}%)"

      return unless duration

      log.puts "\n⏱️ Total time: #{format_duration(duration)}"
    end

    def print_file_lists(results, log)
      log_file_lists(results, log)

      return unless results.problem_files.any?

      printed_section = false

      ISSUE_TYPES.each do |type|
        file_list = results.send(type[:key])
        next unless file_list.any?

        puts "\n #{separator}" if printed_section
        printed_section = true

        puts "\n"
        puts " #{bold("#{type[:label]}:")}"
        puts " #{dimmed(type[:hint])}" if type[:hint]

        file_list.each do |file|
          relative = relative_path(file)
          diagnostics = results.file_diagnostics[file]

          puts ""
          puts " #{cyan(relative)}:"

          if diagnostics&.any?
            diagnostics.each do |diagnostic|
              severity = send(type[:color], type[:symbol])
              location = diagnostic[:line] ? dimmed("at #{diagnostic[:line]}:#{diagnostic[:column]}") : nil
              lines = diagnostic[:message].split("\n")
              puts "   #{severity} #{bold(diagnostic[:name])} #{location}#{" #{dimmed("-")} " if location}#{dimmed(lines.first)}"
              lines.drop(1).each do |line|
                puts "     #{dimmed(line)}"
              end
            end
          else
            severity = send(type[:color], type[:symbol])
            puts "   #{severity} #{type[:label]}"
          end

          puts "\n   #{dimmed(type[:file_hint].call(relative))}" if type[:file_hint]
        end
      end
    end

    def log_file_lists(results, log)
      ISSUE_TYPES.each do |type|
        file_list = results.send(type[:key])
        next unless file_list.any?

        log.puts "\n#{heading("Files: #{type[:label]}")}"
        file_list.each { |file| log.puts file }
      end
    end

    def print_issue_summary(results)
      counts = results.diagnostic_counts
      return if counts.empty?

      puts "\n"
      puts " #{bold("Issue summary:")}"

      counts.each do |name, data|
        count_text = dimmed("(#{data[:count]} #{pluralize(data[:count], "error")} in #{data[:files].size} #{pluralize(data[:files].size, "file")})")
        puts "  #{white(name)} #{count_text}"
      end
    end

    def reportable_files?(results)
      ISSUE_TYPES.any? { |type| type[:reportable] && results.send(type[:key]).any? }
    end

    def print_reportable_files(results)
      reportable_types = ISSUE_TYPES.select { |type| type[:reportable] }
      reportable_files = reportable_types.flat_map { |type|
        results.send(type[:key]).map { |file| [file, type] }
      }
      return if reportable_files.empty?

      reportable_breakdown = reportable_types.filter_map { |type|
        count = results.send(type[:key]).count
        "#{count} #{type[:label].downcase}" if count.positive?
      }

      puts "\n"
      puts " #{bold("Reportable issues:")}"
      puts "  #{dimmed("The following files likely failed due to issues in Herb, not in your templates.")}"
      puts "  #{dimmed("Reporting them helps improve Herb and makes it better for everyone.")}"
      puts "  #{dimmed("See the detailed output above for more information on why each file failed.")}"
      puts ""
      puts "  #{dimmed("#{reportable_files.count} #{pluralize(reportable_files.count, "issue")} could be reported: #{reportable_breakdown.join(", ")}")}"
      puts ""

      reportable_files.each do |(file_path, _issue_type)|
        puts "  #{relative_path(file_path)}"
      end

      puts ""
      puts "  #{dimmed("Run `herb report <file>` to generate a copy-able report for filing an issue.")}"
      puts "  #{dimmed("Run `herb playground <file>` to visually inspect the parse result, see diagnostics, or check if it's already fixed on main.")}"

      puts ""
      puts "  #{dimmed("https://github.com/marcoroth/herb/issues")}"
    end

    def log_problem_file_details(results, log)
      return unless results.problem_files.any?

      log.puts "\n#{heading("FILE CONTENTS AND DETAILS")}"

      results.problem_files.each do |file|
        next unless results.file_contents[file]

        divider = "=" * [80, file.length].max

        log.puts
        log.puts divider
        log.puts file
        log.puts divider

        log.puts "\n#{heading("CONTENT")}"
        log.puts "```erb"
        log.puts results.file_contents[file]
        log.puts "```"

        log_error_outputs(results.error_outputs[file], log)
        log_parse_errors(results.parse_errors[file], log)
        log_compilation_errors(results.compilation_errors[file], log)
      end
    end

    def log_error_outputs(error_output, log)
      return unless error_output

      if error_output[:exit_code]
        log.puts "\n#{heading("EXIT CODE")}"
        log.puts error_output[:exit_code]
      end

      if error_output[:stderr].strip.length.positive?
        log.puts "\n#{heading("ERROR OUTPUT")}"
        log.puts "```"
        log.puts error_output[:stderr]
        log.puts "```"
      end

      return unless error_output[:stdout].strip.length.positive?

      log.puts "\n#{heading("STANDARD OUTPUT")}"
      log.puts "```"
      log.puts error_output[:stdout]
      log.puts "```"
      log.puts
    end

    def log_parse_errors(parse_error, log)
      return unless parse_error

      if parse_error[:stdout].strip.length.positive?
        log.puts "\n#{heading("STANDARD OUTPUT")}"
        log.puts "```"
        log.puts parse_error[:stdout]
        log.puts "```"
      end

      if parse_error[:stderr].strip.length.positive?
        log.puts "\n#{heading("ERROR OUTPUT")}"
        log.puts "```"
        log.puts parse_error[:stderr]
        log.puts "```"
      end

      return unless parse_error[:ast]

      log.puts "\n#{heading("AST")}"
      log.puts "```"
      log.puts parse_error[:ast]
      log.puts "```"
      log.puts
    end

    def log_compilation_errors(compilation_error, log)
      return unless compilation_error

      log.puts "\n#{heading("COMPILATION ERROR")}"
      log.puts "```"
      log.puts compilation_error[:error]
      log.puts "```"

      return unless compilation_error[:backtrace].any?

      log.puts "\n#{heading("BACKTRACE")}"
      log.puts "```"
      log.puts compilation_error[:backtrace].join("\n")
      log.puts "```"
      log.puts
    end

    def label(text, width = 12)
      dimmed(text.ljust(width))
    end

    def stat(count, text, color)
      value = "#{count} #{text}"

      if count.positive?
        bold(send(color, value))
      else
        bold(green(value))
      end
    end

    def relative_path(absolute_path)
      Pathname.new(absolute_path).relative_path_from(Pathname.pwd).to_s
    end

    def pluralize(count, singular, plural = nil)
      count == 1 ? singular : (plural || "#{singular}s")
    end

    def percentage(part, total)
      return 0.0 if total.zero?

      ((part.to_f / total) * 100).round(1)
    end

    def ensure_parallel!
      return if defined?(Parallel)

      require "bundler/inline"

      gemfile(true, quiet: true) do
        source "https://rubygems.org"
        gem "parallel"
      end
    end

    def separator
      dimmed("─" * 60)
    end

    def heading(text)
      prefix = "--- #{text.upcase} "

      prefix + ("-" * (80 - prefix.length))
    end

    def format_duration(seconds)
      if seconds < 1
        "#{(seconds * 1000).round(2)}ms"
      elsif seconds < 60
        "#{seconds.round(2)}s"
      else
        minutes = (seconds / 60).to_i
        remaining_seconds = seconds % 60
        "#{minutes}m #{remaining_seconds.round(2)}s"
      end
    end
  end
end
