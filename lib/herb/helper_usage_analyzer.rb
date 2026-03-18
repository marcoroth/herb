# frozen_string_literal: true

require "pathname"

module Herb
  class HelperUsageAnalyzer
    include Colors

    attr_reader :project_path, :configuration

    def initialize(project_path, configuration: nil)
      @project_path = Pathname.new(File.expand_path(project_path))
      @configuration = configuration || Configuration.load(@project_path.to_s)
    end

    def analyze!
      start_time = Time.now

      begin
        require "prism"
      rescue LoadError
        puts "Error: prism gem is required for 'herb actionview stats'."
        puts ""
        puts "Add it to your Gemfile:"
        puts "  gem 'prism'"
        puts ""
        puts "Or install it directly:"
        puts "  gem install prism"
        exit(1)
      end

      erb_files = find_erb_files

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

      puts dimmed("Scanning #{erb_files.count} #{pluralize(erb_files.count, "file")}...")
      puts ""

      method_counts = Hash.new(0)
      constant_method_counts = Hash.new(0)

      erb_files.each do |file|
        content = File.read(file)
        ruby_source = extract_ruby(content)
        next if ruby_source.nil? || ruby_source.strip.empty?

        locals = extract_locals(content)
        parse_result = Prism.parse(ruby_source)
        locals += collect_assigned_locals(parse_result.value)
        collect_calls(parse_result.value, method_counts, constant_method_counts, locals)
      rescue StandardError => e
        warn "Warning: Could not analyze #{file}: #{e.message}"
      end

      duration = Time.now - start_time

      print_results(method_counts, constant_method_counts, erb_files.count, duration)
    end

    private

    def collect_calls(node, method_counts, constant_method_counts, locals = [])
      return unless node.is_a?(Prism::Node)

      if node.is_a?(Prism::BlockNode)
        block_locals = locals + extract_block_params(node)

        node.child_nodes.compact.each do |child|
          collect_calls(child, method_counts, constant_method_counts, block_locals)
        end

        return
      end

      if node.is_a?(Prism::CallNode)
        method_name = node.name.to_s
        receiver = node.receiver

        if receiver.nil? || receiver.is_a?(Prism::SelfNode)
          method_counts[method_name] += 1 unless locals.include?(method_name)
        elsif receiver.is_a?(Prism::ConstantReadNode)
          constant_method_counts["#{receiver.name}.#{method_name}"] += 1
        elsif (name = named_receiver(receiver)) && !locals.include?(name)
          method_counts[name] += 1
        end
      end

      node.child_nodes.compact.each do |child|
        collect_calls(child, method_counts, constant_method_counts, locals)
      end
    end

    def collect_assigned_locals(node, names = [])
      return names unless node.is_a?(Prism::Node)

      names << node.name.to_s if node.is_a?(Prism::LocalVariableWriteNode)

      node.child_nodes.compact.each { |child| collect_assigned_locals(child, names) }

      names
    end

    def extract_block_params(block_node)
      return [] unless block_node.parameters.is_a?(Prism::BlockParametersNode)

      names = []

      params = block_node.parameters.parameters
      if params.is_a?(Prism::ParametersNode)
        names += params.requireds.filter_map  { |p| p.name.to_s if p.respond_to?(:name) }
        names += params.optionals.filter_map  { |p| p.name.to_s if p.respond_to?(:name) }
        names << params.rest.name.to_s        if params.rest.respond_to?(:name) && params.rest.name
      end

      names += block_node.parameters.locals.map(&:to_s)

      names.reject(&:empty?)
    end

    def named_receiver(node)
      case node
      when Prism::LocalVariableReadNode
        node.name.to_s
      when Prism::InstanceVariableReadNode, Prism::ClassVariableReadNode, Prism::GlobalVariableReadNode
        nil
      when Prism::CallNode
        if node.receiver.nil?
          node.name.to_s if node.arguments.nil? || node.arguments.arguments.empty?
        else
          named_receiver(node.receiver)
        end
      end
    end

    def extract_ruby(content)
      Herb.extract_ruby(content)
    rescue StandardError
      nil
    end

    def extract_locals(content)
      match = content.match(/<%#\s*locals:\s*\(([^)]*)\)/)
      return [] unless match

      match[1].scan(/\b(\w+)\s*:/).map { |m| m[0] }
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

    def print_results(method_counts, constant_method_counts, file_count, duration)
      total_calls = method_counts.values.sum + constant_method_counts.values.sum

      print_all_unique("All helper/method calls", method_counts)
      print_all_unique("All constant method calls", constant_method_counts)

      print_top_calls("Top helper/method calls", method_counts, 30)
      print_top_calls("Top constant method calls", constant_method_counts, 30)

      puts "#{label("Files scanned:")}#{cyan(file_count.to_s)}"
      puts "#{label("Total calls:")}#{cyan(total_calls.to_s)}"
      puts "#{label("Unique methods:")}#{cyan(method_counts.size.to_s)}"
      puts "#{label("Unique const calls:")}#{cyan(constant_method_counts.size.to_s)}"
      puts "#{label("Duration:")}#{dimmed(format("%.2fs", duration))}"
      puts ""
    end

    def print_top_calls(title, counts, limit)
      return if counts.empty?

      puts bold("#{title}:")
      puts ""

      top = counts.sort_by { |_, count| -count }.first(limit)
      max_count = top.first&.last || 1
      max_name_length = top.map { |name, _| name.length }.max || 0

      top.each_with_index do |(name, count), i|
        bar_length = (count.to_f / max_count * 28).round
        bar = "\u2588" * bar_length
        rank = dimmed("#{(i + 1).to_s.rjust(3)}.")
        padded_name = name.ljust(max_name_length)

        puts "  #{rank} #{cyan(padded_name)}  #{bold(count.to_s.rjust(6))}  #{green(bar)}"
      end

      puts ""
    end

    def print_all_unique(title, counts)
      return if counts.empty?

      puts bold("#{title}:")
      puts ""

      sorted = counts.sort_by { |_, count| -count }
      max_name_length = sorted.map { |name, _| name.length }.max || 0
      max_count_length = sorted.map { |_, count| count.to_s.length }.max || 0

      sorted.each do |name, count|
        puts "  #{cyan(name.ljust(max_name_length))}  #{dimmed(count.to_s.rjust(max_count_length))}"
      end

      puts ""
    end

    def label(text)
      text.ljust(20)
    end

    def pluralize(count, singular, plural = nil)
      if count == 1
        singular
      elsif plural
        plural
      else
        "#{singular}s"
      end
    end
  end
end
