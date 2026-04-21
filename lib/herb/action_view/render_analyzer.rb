# frozen_string_literal: true
# typed: false

require "pathname"

module Herb
  module ActionView
    class RenderAnalyzer
      include Colors

      Result = Data.define(:render_calls, :dynamic_calls, :partial_files, :unresolved, :unused, :view_root)

      class Result
        def issues?
          unresolved.any? || unused.any?
        end
      end

      attr_reader :project_path, :configuration

      def initialize(project_path, configuration: nil)
        @project_path = Pathname.new(File.expand_path(project_path))
        @configuration = configuration || Configuration.load(@project_path.to_s)
      end

      def check!
        start_time = Time.now

        erb_files = find_erb_files
        view_root = find_view_root

        if erb_files.empty?
          puts "No ERB files found."
          return false
        end

        puts ""
        puts "#{bold("Herb")} \u{1f33f} #{dimmed("v#{Herb::VERSION}")}"
        puts ""

        if configuration.config_path
          puts "#{green("\u2713")} Using Herb config file at #{dimmed(configuration.config_path.to_s)}"
        else
          puts dimmed("No .herb.yml found, using defaults")
        end

        puts dimmed("Checking render calls in #{erb_files.count} #{pluralize(erb_files.count, "file")}...")

        result = analyze(erb_files, view_root)
        duration = Time.now - start_time

        print_results(result, duration)

        result.issues?
      end

      def fully_resolvable?(file_path)
        file_path = @project_path.join(file_path).to_s unless Pathname.new(file_path).absolute?

        erb_files = find_erb_files
        view_root = find_view_root

        render_calls_by_file = collect_render_calls_by_file(erb_files)
        partial_files = find_partial_files(view_root)

        visited = Set.new
        queue = [file_path]

        while (current = queue.shift)
          next if visited.include?(current)

          visited << current

          calls = render_calls_by_file[current] || []

          calls.each do |call|
            return false if call[:dynamic]

            partial_ref = call[:partial] || call[:layout]
            next unless partial_ref

            return false if dynamic_partial?(partial_ref)

            resolved = resolve_partial(partial_ref, current, partial_files, view_root)
            return false unless resolved

            queue << resolved
          end
        end

        true
      end

      def graph_file!(file_path)
        is_partial = File.basename(file_path).start_with?("_")

        puts ""
        puts " #{bold("Herb")} \u{1f33f} #{dimmed("v#{Herb::VERSION}")}"
        puts ""
        puts " #{dimmed("Building render graph...")}"

        erb_files = find_erb_files
        view_root = find_view_root

        if erb_files.empty?
          puts "No ERB files found in project."
          return
        end

        render_calls_by_file = collect_render_calls_by_file(erb_files)
        ruby_partial_references = collect_ruby_render_references
        partial_files = find_partial_files(view_root)
        render_graph = build_render_graph(render_calls_by_file, partial_files, view_root)

        all_render_calls = render_calls_by_file.values.flatten
        _, dynamic_calls = partition_dynamic(all_render_calls)
        dynamic_prefixes = collect_all_dynamic_prefixes(dynamic_calls, ruby_partial_references)
        reachable = compute_reachable(render_graph, partial_files, ruby_partial_references, dynamic_prefixes)
        reverse_graph = Hash.new { |hash, key| hash[key] = [] } #: Hash[String, Array[String]]

        render_graph.each do |file, partial_names|
          next if file.start_with?("__")

          partial_names.each do |partial_name|
            reverse_graph[partial_name] << file
          end
        end

        ruby_partial_references.each do |reference|
          next unless reference.is_a?(String)

          reverse_graph[reference] << "__ruby__"
        end

        puts ""

        if is_partial
          partial_name = partial_name_for_file(file_path, view_root)

          unless partial_name
            puts "Could not determine partial name for: #{file_path}"
            return
          end

          display = file_display_name(file_path, view_root)
          status = reachable.include?(partial_name) ? green("\u2713") : yellow("~")

          puts " #{status} #{bold(partial_name)} #{dimmed(display)}"
          puts ""

          callers = reverse_graph[partial_name]

          if callers.any?
            puts " #{bold("Rendered by:")}"

            callers.each_with_index do |caller_file, index|
              connector = index == callers.size - 1 ? "\u2514\u2500\u2500" : "\u251c\u2500\u2500"

              if caller_file == "__ruby__"
                puts "   #{connector} #{dimmed("[Ruby code]")}"
              else
                caller_display = file_display_name(caller_file, view_root)
                caller_basename = File.basename(caller_file)
                caller_status = caller_basename.start_with?("_") ? dimmed("(partial)") : dimmed("(entry point)")
                puts "   #{connector} #{cyan(caller_display)} #{caller_status}"
              end
            end

            puts ""
            puts " #{bold("Reachable from:")}"
            entry_chains = trace_to_entry_points(partial_name, reverse_graph, partial_files, view_root)

            if entry_chains.any?
              entry_chains.each_with_index do |chain, index|
                connector = index == entry_chains.size - 1 ? "\u2514\u2500\u2500" : "\u251c\u2500\u2500"
                reversed = chain.reverse

                chain_display = reversed.each_with_index.map do |name, i|
                  if i == 0
                    bold(green(name))
                  elsif i == reversed.size - 1
                    bold(name)
                  else
                    dimmed(name)
                  end
                end.join(dimmed(" \u2192 "))
                puts "   #{connector} #{chain_display}"
              end
            else
              puts "   #{yellow("(not reachable from any entry point)")}"
            end
          else
            puts " #{dimmed("Not rendered by any file.")}"
          end

          children = render_graph[file_path] || []

          if children.any?
            puts ""
            puts " #{bold("Renders:")}"
            print_partial_tree(children, render_graph, partial_files, view_root, reachable, indent: "   ", visited: Set.new)
          end
        else
          display = file_display_name(file_path, view_root)
          puts " #{cyan(display)} #{dimmed("(entry point)")}"
          puts ""

          children = render_graph[file_path] || []

          if children.any?
            puts " #{bold("Renders:")}"
            print_partial_tree(children, render_graph, partial_files, view_root, reachable, indent: "   ", visited: Set.new)
          else
            puts " #{dimmed("No render calls in this file.")}"
          end
        end

        puts ""
      end

      def graph!
        erb_files = find_erb_files
        view_root = find_view_root

        if erb_files.empty?
          puts "No ERB files found."
          return
        end

        puts ""
        puts "#{bold("Herb")} \u{1f33f} #{dimmed("v#{Herb::VERSION}")}"
        puts ""

        if configuration.config_path
          puts "#{green("\u2713")} Using Herb config file at #{dimmed(configuration.config_path.to_s)}"
        else
          puts dimmed("No .herb.yml found, using defaults")
        end

        puts dimmed("Building render graph for #{erb_files.count} #{pluralize(erb_files.count, "file")}...")

        render_calls_by_file = collect_render_calls_by_file(erb_files)
        ruby_partial_references = collect_ruby_render_references
        partial_files = find_partial_files(view_root)
        render_graph = build_render_graph(render_calls_by_file, partial_files, view_root)

        all_render_calls = render_calls_by_file.values.flatten
        _, dynamic_calls = partition_dynamic(all_render_calls)
        dynamic_prefixes = collect_all_dynamic_prefixes(dynamic_calls, ruby_partial_references)
        reverse_graph = Hash.new { |hash, key| hash[key] = [] } #: Hash[String, Array[String]]

        render_graph.each do |file, partial_names|
          next if file.start_with?("__")

          display_name = file_display_name(file, view_root)

          partial_names.each do |partial_name|
            reverse_graph[partial_name] << display_name
          end
        end

        ruby_partial_references.each do |reference|
          next unless reference.is_a?(String)

          reverse_graph[reference] << "#{dimmed("[Ruby]")} #{reference}"
        end

        entry_points = render_graph.keys.reject { |file|
          file.start_with?("__") || File.basename(file).start_with?("_")
        }.sort

        reachable = compute_reachable(render_graph, partial_files, ruby_partial_references, dynamic_prefixes)

        puts ""
        puts separator
        puts ""

        if entry_points.any?
          puts " #{bold("Entry points:")} #{dimmed("(#{entry_points.count} #{pluralize(entry_points.count, "template")})")}"

          entry_points.each do |file|
            display = file_display_name(file, view_root)
            partials = render_graph[file] || []

            puts ""
            puts " #{cyan(display)}"

            if partials.empty?
              puts "   #{dimmed("(no render calls)")}"
            else
              print_partial_tree(partials, render_graph, partial_files, view_root, reachable, indent: "   ", visited: Set.new)
            end
          end
        end

        ruby_static_references = ruby_partial_references.select { |reference| reference.is_a?(String) }

        if ruby_static_references.any?
          puts ""
          puts " #{separator}"
          puts ""
          puts " #{bold("Ruby references:")} #{dimmed("(#{ruby_static_references.count} #{pluralize(ruby_static_references.count, "partial")})")}"

          ruby_static_references.sort.each do |reference|
            resolved = partial_files[reference]
            status = resolved ? green("\u2713") : red("\u2717")
            puts ""
            puts "   #{status} #{bold(reference)}"

            if resolved
              children = render_graph[resolved] || []
              print_partial_tree(children, render_graph, partial_files, view_root, reachable, indent: "     ", visited: Set.new)
            end
          end
        end

        unreachable = partial_files.except(*reachable)

        puts ""
        puts " #{separator}"
        puts ""
        puts " #{bold("Partial usage:")} #{dimmed("(who renders each partial)")}"

        partial_files.keys.sort.each do |name|
          callers = reverse_graph[name]
          status = reachable.include?(name) ? green("\u2713") : yellow("~")

          puts ""
          puts "   #{status} #{bold(name)}"

          if callers.any?
            callers.sort.each_with_index do |caller_name, index|
              connector = index == callers.size - 1 ? "\u2514\u2500\u2500" : "\u251c\u2500\u2500"
              puts "     #{connector} #{dimmed("rendered by")} #{caller_name}"
            end
          else
            puts "     #{dimmed("(not rendered by any file)")}"
          end
        end

        if unreachable.any?
          puts ""
          puts " #{separator}"
          puts ""
          puts " #{bold(yellow("Unreachable partials:"))} #{dimmed("(#{unreachable.count} #{pluralize(unreachable.count, "file")})")}"

          unreachable.each do |name, file|
            display = file_display_name(file, view_root)
            children = render_graph[file] || []

            puts ""
            puts "   #{yellow("~")} #{bold(name)} #{dimmed(display)}"

            if children.any?
              print_partial_tree(children, render_graph, partial_files, view_root, reachable, indent: "     ", visited: Set.new)
            end
          end
        end

        puts ""
        puts " #{separator}"
        puts ""
        puts " #{bold("Summary:")}"
        puts "  #{label("Entry points")} #{cyan(entry_points.count.to_s)}"
        puts "  #{label("Partials")} #{cyan(partial_files.count.to_s)}"
        puts "  #{label("Reachable")} #{bold(green(reachable.count.to_s))}"
        puts "  #{label("Unreachable")} #{unreachable.any? ? bold(yellow(unreachable.count.to_s)) : bold(green("0"))}"
        puts ""
      end

      def analyze(erb_files = nil, view_root = nil)
        erb_files ||= find_erb_files
        view_root ||= find_view_root

        render_calls_by_file = collect_render_calls_by_file(erb_files)
        ruby_partial_references = collect_ruby_render_references
        partial_files = find_partial_files(view_root)

        all_render_calls = render_calls_by_file.values.flatten
        static_calls, dynamic_calls = partition_dynamic(all_render_calls)

        render_graph = build_render_graph(render_calls_by_file, partial_files, view_root)

        unresolved = find_unresolved(static_calls, partial_files, view_root)

        unused = find_unused_by_reachability(
          render_graph, partial_files, ruby_partial_references,
          collect_all_dynamic_prefixes(dynamic_calls, ruby_partial_references),
          view_root
        )

        Result.new(
          render_calls: all_render_calls,
          dynamic_calls: dynamic_calls,
          partial_files: partial_files,
          unresolved: unresolved,
          unused: unused,
          view_root: view_root
        )
      end

      def analyze_from_collected(render_calls_by_file:, dynamic_prefixes_from_erb: [], layout_refs_from_erb: [])
        view_root = find_view_root

        @dynamic_prefixes_from_erb = dynamic_prefixes_from_erb
        @layout_refs_from_erb = layout_refs_from_erb

        ruby_partial_references = collect_ruby_render_references
        partial_files = find_partial_files(view_root)

        all_render_calls = render_calls_by_file.values.flatten
        static_calls, dynamic_calls = partition_dynamic(all_render_calls)

        render_graph = build_render_graph(render_calls_by_file, partial_files, view_root)

        unresolved = find_unresolved(static_calls, partial_files, view_root)

        unused = find_unused_by_reachability(
          render_graph, partial_files, ruby_partial_references,
          collect_all_dynamic_prefixes(dynamic_calls, ruby_partial_references),
          view_root
        )

        Result.new(
          render_calls: all_render_calls,
          dynamic_calls: dynamic_calls,
          partial_files: partial_files,
          unresolved: unresolved,
          unused: unused,
          view_root: view_root
        )
      end

      def print_file_lists(result)
        return unless result.issues?

        if result.unresolved.any?
          puts "\n"
          puts " #{bold("Unresolved render calls:")}"
          puts " #{dimmed("These render calls reference partials that could not be found on disk.")}"

          grouped = result.unresolved.group_by { |call| call[:file] }

          grouped.each do |file, calls|
            relative = relative_path(file)

            puts ""
            puts " #{cyan(relative)}:"

            calls.each do |call|
              location = call[:location] ? dimmed("at #{call[:location]}") : nil
              expected = expected_file_path(call[:partial], result.view_root)
              puts "   #{red("\u2717")} #{bold(call[:partial])} #{location} #{dimmed("-")} #{dimmed(expected)}"
            end
          end
        end

        return unless result.unused.any?

        puts "\n #{separator}" if result.unresolved.any?
        puts "\n"
        puts " #{bold("Unused partials:")}"
        puts " #{dimmed("These partial files are not referenced by any reachable render call.")}"

        result.unused.each do |name, file|
          relative = relative_path(file)

          puts ""
          puts " #{cyan(relative)}:"
          puts "   #{yellow("~")} #{bold(name)} #{dimmed("not referenced")}"
        end
      end

      def print_issue_summary(result)
        return unless result.issues?

        if result.unresolved.any?
          files_count = result.unresolved.map { |call| call[:file] }.uniq.count

          puts "  #{white("Unresolved partials")} #{dimmed("(#{result.unresolved.count} #{pluralize(result.unresolved.count, "reference")} in #{files_count} #{pluralize(files_count, "file")})")}"
        end

        return unless result.unused.any?

        puts "  #{white("Unused partials")} #{dimmed("(#{result.unused.count} #{pluralize(result.unused.count, "file")})")}"
      end

      def print_summary_line(result)
        render_parts = [] #: Array[String]

        partials_only = result.render_calls.count { |call| call[:partial] }
        render_parts << stat(result.render_calls.count, "total", :green)
        render_parts << stat(partials_only, "with partial", :green)
        render_parts << stat(result.dynamic_calls.count, "dynamic", :yellow) if result.dynamic_calls.any?
        other_count = result.render_calls.count - partials_only
        render_parts << stat(other_count, "other", :green) if other_count.positive?

        partial_parts = [] #: Array[String]
        partial_parts << stat(result.partial_files.count, "on disk", :green)
        partial_parts << stat(result.unresolved.count, "unresolved", :red) if result.unresolved.any?
        partial_parts << stat(result.unused.count, "unused", :yellow) if result.unused.any?

        puts "  #{label("Renders")} #{render_parts.join(" | ")}"
        puts "  #{label("Partials")} #{partial_parts.join(" | ")}"
      end

      private

      def print_partial_tree(partial_names, render_graph, partial_files, view_root, reachable, indent: "", visited: Set.new)
        partial_names.each_with_index do |name, index|
          is_last = index == partial_names.size - 1
          connector = is_last ? "\u2514\u2500\u2500" : "\u251c\u2500\u2500"
          child_indent = is_last ? "    " : "\u2502   "

          resolved_file = partial_files[name]
          status = if !resolved_file
                     red("\u2717")
                   elsif reachable.include?(name)
                     green("\u2713")
                   else
                     yellow("~")
                   end

          puts "#{indent}#{connector} #{status} #{name}"

          next unless resolved_file
          next if visited.include?(name)

          visited.add(name)

          children = render_graph[resolved_file] || []

          if children.any?
            print_partial_tree(children, render_graph, partial_files, view_root, reachable, indent: "#{indent}#{child_indent}", visited: visited)
          end
        end
      end

      def file_display_name(file, view_root)
        Pathname.new(file).relative_path_from(view_root).to_s
      rescue ArgumentError
        relative_path(file)
      end

      def compute_reachable(render_graph, partial_files, ruby_references, dynamic_prefixes)
        reachable = Set.new
        queue = [] #: Array[String]

        render_graph.each_key do |file|
          next if file.start_with?("__")

          basename = File.basename(file)
          next if basename.start_with?("_")

          queue << file
        end

        ruby_references.each do |reference|
          next unless reference.is_a?(String)

          reachable << reference
          resolved_file = partial_files[reference]
          queue << resolved_file if resolved_file
        end

        (render_graph["__layout_refs__"] || []).each do |layout_name|
          reachable << layout_name
          resolved_file = partial_files[layout_name]
          queue << resolved_file if resolved_file
        end

        visited_files = Set.new

        until queue.empty?
          current_file = queue.shift
          next if visited_files.include?(current_file)

          visited_files << current_file

          partial_names = render_graph[current_file] || []

          partial_names.each do |partial_name|
            next if reachable.include?(partial_name)

            reachable << partial_name

            resolved_file = partial_files[partial_name]
            queue << resolved_file if resolved_file && render_graph.key?(resolved_file)
          end
        end

        partial_files.each_key do |name|
          if dynamic_prefixes.any? { |prefix| name.start_with?("#{prefix}/") }
            reachable << name
          end
        end

        reachable
      end

      def trace_to_entry_points(partial_name, reverse_graph, _partial_files, view_root)
        chains = [] #: Array[Array[String]]
        queue = [[partial_name]]
        visited = Set.new([partial_name])

        until queue.empty?
          current_chain = queue.shift

          current_name = current_chain.last
          callers = reverse_graph[current_name] || []

          callers.each do |caller_file|
            next if caller_file == "__ruby__"

            caller_basename = File.basename(caller_file)

            if caller_basename.start_with?("_")
              caller_name = partial_name_for_file(caller_file, view_root)
              next unless caller_name
              next if visited.include?(caller_name)

              visited.add(caller_name)
              queue << (current_chain + [caller_name])
            else
              entry_display = file_display_name(caller_file, view_root)
              chains << (current_chain + [entry_display])
            end
          end

          if callers.include?("__ruby__")
            chains << (current_chain + ["[Ruby code]"])
          end
        end

        chains
      end

      def print_results(result, duration)
        if result.issues?
          puts ""
          puts separator
        end

        print_file_lists(result)

        if result.issues?
          puts "\n #{separator}"
          puts "\n"
          puts " #{bold("Issue summary:")}"
          print_issue_summary(result)
        end

        puts "\n #{separator}"

        scanned_files = result.render_calls.map { |call| call[:file] }.uniq.count
        issues = result.unresolved.count + result.unused.count

        puts "\n"
        puts " #{bold("Summary:")}"

        puts "  #{label("Version")} #{cyan(Herb.version)}"
        puts "  #{label("Checked")} #{cyan("#{scanned_files} #{pluralize(scanned_files, "file")}")}"

        print_summary_line(result)

        puts "  #{label("Duration")} #{cyan(format_duration(duration))}"

        if issues.zero?
          puts ""
          puts " #{bold(green("\u2713"))} #{green("All render calls resolve and all partials are used!")}"
        end

        puts ""
      end

      def find_erb_files
        patterns = configuration.file_include_patterns
        exclude = configuration.file_exclude_patterns

        files = patterns.flat_map { |pattern| Dir[File.join(@project_path, pattern)] }.uniq

        files.reject do |file|
          relative = Pathname.new(file).relative_path_from(@project_path).to_s
          exclude.any? { |pattern| File.fnmatch?(pattern, relative, File::FNM_PATHNAME) }
        end.sort
      end

      def find_view_root
        candidates = [
          @project_path.join("app", "views"),
          @project_path
        ]

        candidates.find(&:directory?) || @project_path
      end

      def find_partial_files(view_root)
        return {} unless view_root.directory?

        partials = {} #: Hash[String, String]

        Dir[File.join(view_root, "**", Herb::PARTIAL_GLOB_PATTERN)].each do |file|
          partial_name = partial_name_for_file(file, view_root)
          partials[partial_name] = file if partial_name
        end

        partials
      end

      def partial_name_for_file(file_path, view_root)
        relative = Pathname.new(file_path).relative_path_from(view_root).to_s

        directory = File.dirname(relative)
        basename = File.basename(relative)

        return nil unless basename.start_with?("_")

        name = basename.sub(/\A_/, "").sub(/\..*\z/, "")

        if directory == "."
          name
        else
          "#{directory}/#{name}"
        end
      end

      def collect_render_calls_by_file(files)
        @dynamic_prefixes_from_erb = [] #: Array[String]
        @layout_refs_from_erb = [] #: Array[String]

        ensure_parallel!

        file_results = Parallel.map(files, in_processes: Parallel.processor_count) do |file|
          process_file_for_render_calls(file)
        end

        render_calls_by_file = {} #: Hash[String, Array[Hash[Symbol, untyped]]]

        file_results.each do |file_result|
          next unless file_result

          render_calls_by_file[file_result[:file]] = file_result[:calls]
          @dynamic_prefixes_from_erb.concat(file_result[:dynamic_prefixes])
          @layout_refs_from_erb.concat(file_result[:layout_references])
        end

        render_calls_by_file
      end

      def process_file_for_render_calls(file)
        content = File.read(file)
        result = Herb.parse(content, render_nodes: true)

        visitor = RenderCallVisitor.new(file)
        visitor.visit(result.value)
        calls = visitor.render_calls.dup

        visitor_partials = calls.filter_map { |call| call[:partial] }.to_set

        dynamic_prefixes = [] #: Array[untyped]
        layout_references = [] #: Array[untyped]

        content.scan(%r{render[\s(]+(?:partial:\s*)?["']([a-z0-9_/]+)["']}) do |match|
          partial = match[0]
          next if visitor_partials.include?(partial)

          calls << { file: file, partial: partial }
        end

        content.scan(%r{render\s+(?:partial:\s*)?["']([a-z0-9_/]+)/\#\{}) do |match|
          dynamic_prefixes << match[0]
        end

        content.scan(%r{render\s+layout:\s*["']([a-z0-9_/]+)["']}) do |match|
          layout_references << match[0]
        end

        { file: file, calls: calls, dynamic_prefixes: dynamic_prefixes, layout_references: layout_references }
      rescue StandardError => e
        warn "Warning: Could not parse #{file}: #{e.message}"
        nil
      end

      def ensure_parallel!
        return if defined?(Parallel)

        require "bundler/inline"

        gemfile(true, quiet: true) do # steep:ignore
          source "https://rubygems.org" # steep:ignore
          gem "parallel" # steep:ignore
        end
      end

      def collect_ruby_render_references
        references = [] #: Array[untyped]

        ruby_directories = [
          @project_path.join("app"),
          @project_path.join("lib")
        ]

        ruby_directories.each do |directory|
          next unless directory.directory?

          Dir[File.join(directory, "**", "*.rb")].each do |file|
            content = File.read(file)

            content.scan(%r{(?:render\s+(?:partial:\s*)?|(?:self\.)?partial(?:\s*[:=]\s*|\s*=\s*))["']([a-z0-9_/]+)["']}) do |match|
              references << match[0]
            end

            content.scan(%r{(?:render\s+(?:partial:\s*)?|(?:self\.)?partial(?:\s*[:=]\s*|\s*=\s*))["']([a-z0-9_/]+)/\#\{}) do |match|
              references << { prefix: match[0] }
            end
          rescue StandardError
            next
          end
        end

        references
      end

      def build_render_graph(render_calls_by_file, partial_files, view_root)
        graph = {} #: Hash[String, Array[String]]

        render_calls_by_file.each do |file, calls|
          resolved_names = [] #: Array[String]

          calls.each do |call|
            partial_reference = call[:partial] || call[:layout]
            next unless partial_reference

            resolved = resolve_partial(partial_reference, file, partial_files, view_root)
            if resolved
              resolved_name = partial_name_for_file(resolved, view_root)
              resolved_names << resolved_name if resolved_name
            else
              resolved_names << partial_reference
            end
          end

          graph[file] = resolved_names.uniq
        end

        (@layout_refs_from_erb || []).each do |layout_reference|
          graph["__layout_refs__"] ||= []
          graph["__layout_refs__"] << layout_reference
        end

        graph
      end

      def find_unused_by_reachability(render_graph, partial_files, ruby_references, dynamic_prefixes, _view_root)
        reachable = Set.new
        queue = [] #: Array[String]

        render_graph.each_key do |file|
          next if file.start_with?("__")

          basename = File.basename(file)
          next if basename.start_with?("_")

          queue << file
        end

        ruby_references.each do |reference|
          next unless reference.is_a?(String)

          reachable << reference
          resolved_file = partial_files[reference]

          queue << resolved_file if resolved_file
        end

        (render_graph["__layout_refs__"] || []).each do |layout_name|
          reachable << layout_name
          resolved_file = partial_files[layout_name]
          queue << resolved_file if resolved_file
        end

        visited_files = Set.new

        until queue.empty?
          current_file = queue.shift
          next if visited_files.include?(current_file)

          visited_files << current_file

          partial_names = render_graph[current_file] || []

          partial_names.each do |partial_name|
            next if reachable.include?(partial_name)

            reachable << partial_name

            resolved_file = partial_files[partial_name]
            queue << resolved_file if resolved_file && render_graph.key?(resolved_file)
          end
        end

        partial_files.each_key do |name|
          if dynamic_prefixes.any? { |prefix| name.start_with?("#{prefix}/") }
            reachable << name
          end
        end

        partial_files.except(*reachable)
      end

      def partition_dynamic(render_calls)
        static = [] #: Array[Hash[Symbol, untyped]]
        dynamic = [] #: Array[Hash[Symbol, untyped]]

        render_calls.each do |call|
          if call[:partial] && dynamic_partial?(call[:partial])
            dynamic << call
          else
            static << call
          end
        end

        [static, dynamic]
      end

      def dynamic_partial?(partial_name)
        partial_name.include?("\#{") || partial_name.include?("#\{") || partial_name.match?(%r{[^a-z0-9_/]})
      end

      def collect_all_dynamic_prefixes(dynamic_calls, ruby_references)
        prefixes = dynamic_calls.filter_map { |call|
          next unless call[:partial]

          prefix = call[:partial].gsub(/\A["']|["']\z/, "")
          prefix = prefix.split("\#{").first&.chomp("/")
          prefix unless prefix.nil? || prefix.empty?
        }

        ruby_references.each do |reference|
          prefixes << reference[:prefix] if reference.is_a?(Hash) && reference[:prefix]
        end

        prefixes.concat(@dynamic_prefixes_from_erb || [])
        prefixes.uniq
      end

      def find_unresolved(render_calls, partial_files, view_root)
        render_calls.select do |call|
          next false unless call[:partial]

          !resolve_partial(call[:partial], call[:file], partial_files, view_root)
        end
      end

      def resolve_partial(partial_name, source_file, partial_files, view_root)
        return partial_files[partial_name] if partial_files.key?(partial_name)

        source_directory = begin
          Pathname.new(File.dirname(source_file)).relative_path_from(view_root).to_s
        rescue ArgumentError
          nil
        end

        if source_directory && source_directory != "."
          relative_name = "#{source_directory}/#{partial_name}"
          return partial_files[relative_name] if partial_files.key?(relative_name)
        end

        unless partial_name.include?("/")
          application_name = "application/#{partial_name}"
          return partial_files[application_name] if partial_files.key?(application_name)
        end

        nil
      end

      def expected_file_path(partial_name, view_root)
        parts = partial_name.split("/")
        parts[-1] = "_#{parts[-1]}"
        relative = parts.join("/")

        relative_root = relative_path(view_root.to_s)

        Herb::PARTIAL_EXTENSIONS.map { |extension| "#{relative_root}/#{relative}#{extension}" }.join(", ")
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

      def separator
        dimmed("\u2500" * 60)
      end

      def pluralize(count, singular, plural = nil)
        count == 1 ? singular : (plural || "#{singular}s")
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

      def relative_path(path)
        Pathname.new(path).relative_path_from(Pathname.pwd).to_s
      rescue ArgumentError
        path.to_s
      end
    end

    class RenderCallVisitor < Visitor
      attr_reader :render_calls

      def initialize(file)
        @file = file
        @render_calls = []
      end

      def visit_erb_render_node(node)
        call = { file: @file }

        call[:partial] = node.partial_path if node.static_partial?
        call[:template_path] = node.template_name if node.template_name
        call[:layout] = node.layout_name if node.layout_name
        call[:file_path] = node.keywords&.file&.value if node.keywords&.file
        call[:inline] = true if node.keywords&.inline_template
        call[:renderable] = node.keywords&.renderable&.value if node.keywords&.renderable
        call[:dynamic] = true if node.dynamic?

        call[:body] = true if node.keywords&.body
        call[:plain] = true if node.keywords&.plain
        call[:html] = true if node.keywords&.html

        if node.location
          call[:location] = "#{node.location.start.line}:#{node.location.start.column}"
        end

        @render_calls << call

        super
      end
    end
  end
end
