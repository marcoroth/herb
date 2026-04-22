# frozen_string_literal: true

require "benchmark"
require "difftastic"
require "lipgloss"
require "yaml"
require "reactionview/template/handlers/herb/herb"

require_relative "../../test/engine/action_view/action_view_test_helper"

module Bench
  module BenchmarkHelper
    include Engine::ActionViewTestHelper

    LABEL_WIDTH = 50
    RENDER_ITERATIONS = 5000
    COMPILE_ITERATIONS = 500
    WARMUP_ITERATIONS = 100

    def bold(str)    = "\e[1m#{str}\e[0m"
    def dimmed(str)  = "\e[2m#{str}\e[0m"
    def green(str)   = "\e[32m#{str}\e[0m"
    def red(str)     = "\e[31m#{str}\e[0m"

    class ActionViewHelperCounter < Herb::Visitor
      attr_reader :count

      def initialize
        super

        @count = 0
      end

      def visit_html_element_node(node)
        @count += 1 if node.element_source && node.element_source != "HTML"
        super
      end
    end

    def count_action_view_helpers(ast)
      counter = ActionViewHelperCounter.new
      counter.visit(ast)
      counter.count
    end

    def fresh_action_view_context
      lookup_context = ::ActionView::LookupContext.new([])
      view = ::ActionView::Base.with_empty_template_cache.new(lookup_context, {}, nil)
      view.class.include(Turbo::FramesHelper) if defined?(Turbo::FramesHelper)
      view.class.include(Engine::ActionViewTestHelper::SimpleUrlFor)
      view
    end

    def bar(ratio, width: 40)
      filled = [(ratio * width).round, width].min
      "#{green("█" * filled)}#{dimmed("░" * (width - filled))}"
    end

    def per_iteration_label(total_seconds, iterations, unit)
      format("(%<time>s/%<unit>s)", time: format_time(total_seconds / iterations), unit: unit)
    end

    def format_time(seconds)
      if seconds < 0.001
        format("%<value>.1fµs", value: seconds * 1_000_000)
      elsif seconds < 1
        format("%<value>.2fms", value: seconds * 1000)
      else
        format("%<value>.2fs", value: seconds)
      end
    end

    BASELINE_THRESHOLD = 1.05

    def format_multiplier(ratio, label)
      if ratio >= 2.0
        format("%<ratio>.0fx %<label>s", ratio: ratio, label: label)
      else
        format("%<ratio>.1fx %<label>s", ratio: ratio, label: label)
      end
    end

    def format_ratio(ratio)
      if ratio > BASELINE_THRESHOLD
        format_multiplier(ratio, "faster")
      elsif ratio < (1.0 / BASELINE_THRESHOLD)
        format_multiplier(1.0 / ratio, "slower")
      else
        "~baseline"
      end
    end

    def format_compile_ratio(ratio)
      if ratio > BASELINE_THRESHOLD
        format_multiplier(ratio, "slower")
      elsif ratio < (1.0 / BASELINE_THRESHOLD)
        format_multiplier(1.0 / ratio, "faster")
      else
        "~baseline"
      end
    end

    def format_size_ratio(ratio)
      change = ((1 - ratio) * 100).round

      if change.positive?
        "#{change}% smaller"
      elsif change.negative?
        "#{change.abs}% larger"
      else
        "same size"
      end
    end

    def format_break_even(renders)
      if renders.nil?
        "N/A"
      elsif renders <= 1
        "immediate"
      else
        "#{renders} renders"
      end
    end

    def html_differ
      @html_differ ||= Difftastic::Differ.new(color: :always)
    end

    def diff_html_output(expected, actual)
      html_differ.diff_html(expected, actual)
    end

    def print_output_diff(expected, actual)
      diff_result = diff_html_output(expected, actual)

      if diff_result == "No syntactic changes."
        puts "    #{dimmed("(whitespace-only differences)")}"
      else
        diff_result.each_line do |line|
          puts "    #{line}"
        end
      end
    end

    def load_benchmark(path, binding_context: nil)
      content = File.read(path)
      parts = content.split(/^---\s*$/, 2)

      raise "Invalid benchmark file: #{path} (missing --- separator)" unless parts.length == 2

      frontmatter = YAML.safe_load(parts[0], permitted_classes: [Symbol])
      template = parts[1].lstrip

      locals = {}

      (frontmatter["locals"] || {}).each do |key, value|
        locals[key.to_sym] = eval(value, binding_context || binding)
      end

      (frontmatter["instance_variables"] || {}).each do |key, value|
        locals[:"@#{key}"] = eval(value, binding_context || binding)
      end

      {
        title: frontmatter["title"],
        subtitle: frontmatter["subtitle"],
        template: template,
        fixture: path,
        locals: locals,
      }
    end

    def run_benchmark(title:, template:, locals: {}, subtitle: nil, fixture: nil, results: nil) # rubocop:disable Metrics/ParameterLists
      parse_result = Herb.parse(template, action_view_helpers: true)
      helper_count = count_action_view_helpers(parse_result.value)

      WARMUP_ITERATIONS.times { ::ActionView::Template::Handlers::ERB::Erubi.new(template) }
      WARMUP_ITERATIONS.times { ReActionView::Template::Handlers::Herb::Herb.new(template, optimize: false) }
      WARMUP_ITERATIONS.times { ReActionView::Template::Handlers::Herb::Herb.new(template, optimize: true) }

      compile_times = {}

      GC.start
      GC.disable

      compile_times[:erubi] = Benchmark.measure { COMPILE_ITERATIONS.times { ::ActionView::Template::Handlers::ERB::Erubi.new(template) } }
      compile_times[:herb] = Benchmark.measure { COMPILE_ITERATIONS.times { ReActionView::Template::Handlers::Herb::Herb.new(template, optimize: false) } }
      compile_times[:herb_precompiled] = Benchmark.measure { COMPILE_ITERATIONS.times { ReActionView::Template::Handlers::Herb::Herb.new(template, optimize: true) } }

      GC.enable

      reactionview_with = ReActionView::Template::Handlers::Herb::Herb.new(template, optimize: true).src
      reactionview_without = ReActionView::Template::Handlers::Herb::Herb.new(template, optimize: false).src
      erubi_compiled = ::ActionView::Template::Handlers::ERB::Erubi.new(template).src

      local_assigns_code = locals.map { |key, _| "#{key} = local_assigns[:#{key}]" }.join("; ")
      local_prefix = locals.empty? ? "" : "#{local_assigns_code}; "

      context_erubi = fresh_action_view_context
      context_without = fresh_action_view_context
      context_with = fresh_action_view_context

      if locals.empty?
        context_erubi.instance_eval("def _erubi; @output_buffer = ::ActionView::OutputBuffer.new; #{erubi_compiled}; end", __FILE__, __LINE__)
        context_without.instance_eval("def _herb; @output_buffer = ::ActionView::OutputBuffer.new; #{reactionview_without}; end", __FILE__, __LINE__)
        context_with.instance_eval("def _herb_precompiled; @output_buffer = ::ActionView::OutputBuffer.new; #{reactionview_with}; end", __FILE__, __LINE__)
      else
        context_erubi.instance_eval("def _erubi(local_assigns); @output_buffer = ::ActionView::OutputBuffer.new; #{local_prefix}#{erubi_compiled}; end", __FILE__, __LINE__)
        context_without.instance_eval("def _herb(local_assigns); @output_buffer = ::ActionView::OutputBuffer.new; #{local_prefix}#{reactionview_without}; end", __FILE__, __LINE__)
        context_with.instance_eval("def _herb_precompiled(local_assigns); @output_buffer = ::ActionView::OutputBuffer.new; #{local_prefix}#{reactionview_with}; end", __FILE__, __LINE__)
      end

      call_args = locals.empty? ? [] : [locals]

      erubi_output = context_erubi.send(:_erubi, *call_args).to_s.strip
      herb_output = context_without.send(:_herb, *call_args).to_s.strip
      herb_precompiled_output = context_with.send(:_herb_precompiled, *call_args).to_s.strip

      erubi_herb_match = erubi_output == herb_output
      erubi_precompiled_match = erubi_output == herb_precompiled_output
      outputs_match = erubi_herb_match && erubi_precompiled_match

      whitespace_only_mismatch = false

      unless outputs_match
        diffs = []
        diffs << diff_html_output(erubi_output, herb_output) unless erubi_herb_match
        diffs << diff_html_output(erubi_output, herb_precompiled_output) unless erubi_precompiled_match

        whitespace_only_mismatch = diffs.all? { |diff| diff.include?("No syntactic changes") || diff.include?("No changes") }
      end

      WARMUP_ITERATIONS.times { context_erubi.send(:_erubi, *call_args) }
      WARMUP_ITERATIONS.times { context_without.send(:_herb, *call_args) }
      WARMUP_ITERATIONS.times { context_with.send(:_herb_precompiled, *call_args) }

      render_times = {}

      GC.start
      GC.disable

      render_times[:erubi] = Benchmark.measure { RENDER_ITERATIONS.times { context_erubi.send(:_erubi, *call_args) } }
      render_times[:herb] = Benchmark.measure { RENDER_ITERATIONS.times { context_without.send(:_herb, *call_args) } }
      render_times[:herb_precompiled] = Benchmark.measure { RENDER_ITERATIONS.times { context_with.send(:_herb_precompiled, *call_args) } }

      GC.enable

      baseline_render = render_times[:erubi].real
      max_render = render_times.values.map(&:real).max
      baseline_compile = compile_times[:erubi].real
      max_compile = compile_times.values.map(&:real).max

      herb_compile_ratio = compile_times[:herb].real / baseline_compile
      herb_precompiled_compile_ratio = compile_times[:herb_precompiled].real / baseline_compile
      herb_render_ratio = baseline_render / render_times[:herb].real
      herb_precompiled_render_ratio = baseline_render / render_times[:herb_precompiled].real

      compile_overhead = (compile_times[:herb_precompiled].real - compile_times[:erubi].real) / COMPILE_ITERATIONS
      render_savings = (render_times[:erubi].real - render_times[:herb_precompiled].real) / RENDER_ITERATIONS

      break_even_renders = if render_savings.positive? && herb_precompiled_render_ratio > BASELINE_THRESHOLD
                             (compile_overhead / render_savings).ceil
                           end

      puts ""
      puts bold("  Herb Engine Benchmark: #{title}")
      puts dimmed("  #{subtitle}") if subtitle

      if fixture
        relative = fixture.sub("#{File.expand_path("../..", __dir__)}/", "")
        puts dimmed("  File: #{relative}")
      end

      puts dimmed("  Template: #{template.lines.count} lines, #{helper_count} ActionView helper calls#{", #{locals.size} locals" unless locals.empty?}")
      puts ""

      if outputs_match
        puts "  #{dimmed("Output: all engines produce identical HTML")}"
      elsif whitespace_only_mismatch
        puts "  #{dimmed("Output: whitespace-only differences (semantically identical HTML)")}"
      else
        puts "  #{bold(red("Output: MISMATCH — semantic HTML differences detected"))}"

        unless erubi_herb_match
          puts ""
          puts "  #{red("Erubi vs Herb:")}"
          print_output_diff(erubi_output, herb_output)
        end

        unless erubi_precompiled_match
          puts ""
          puts "  #{red("Erubi vs Herb (precompiled):")}"
          print_output_diff(erubi_output, herb_precompiled_output)
        end
      end
      puts ""

      puts "  #{bold("Compile")} #{dimmed("(#{COMPILE_ITERATIONS} iterations, #{WARMUP_ITERATIONS} warmup)")}"
      puts ""
      puts "  #{"Erubi via ActionView".ljust(LABEL_WIDTH)} #{bar(compile_times[:erubi].real / max_compile, width: 20)}  #{bold(format_time(compile_times[:erubi].real))}  #{dimmed(per_iteration_label(compile_times[:erubi].real, COMPILE_ITERATIONS, "compile"))}  #{dimmed("(baseline)")}"

      herb_compile_label = format_compile_ratio(herb_compile_ratio)
      herb_precompiled_compile_label = format_compile_ratio(herb_precompiled_compile_ratio)
      herb_compile_styled = herb_compile_label.include?("slower") ? bold(red(herb_compile_label)) : dimmed(herb_compile_label)
      herb_precompiled_compile_styled = herb_precompiled_compile_label.include?("slower") ? bold(red(herb_precompiled_compile_label)) : dimmed(herb_precompiled_compile_label)

      puts "  #{"Herb via ActionView".ljust(LABEL_WIDTH)} #{bar(compile_times[:herb].real / max_compile, width: 20)}  #{bold(format_time(compile_times[:herb].real))}  #{dimmed(per_iteration_label(compile_times[:herb].real, COMPILE_ITERATIONS, "compile"))}  #{herb_compile_styled}"
      puts "  #{"Herb via ActionView (precompiled helpers)".ljust(LABEL_WIDTH)} #{bar(compile_times[:herb_precompiled].real / max_compile, width: 20)}  #{bold(format_time(compile_times[:herb_precompiled].real))}  #{dimmed(per_iteration_label(compile_times[:herb_precompiled].real, COMPILE_ITERATIONS, "compile"))}  #{herb_precompiled_compile_styled}"
      puts ""

      puts "  #{bold("Render")} #{dimmed("(#{RENDER_ITERATIONS} iterations, #{WARMUP_ITERATIONS} warmup)")}"
      puts ""

      herb_render_label = format_ratio(herb_render_ratio)
      herb_precompiled_render_label = format_ratio(herb_precompiled_render_ratio)

      puts "  #{"Erubi via ActionView".ljust(LABEL_WIDTH)} #{bar(render_times[:erubi].real / max_render)}  #{bold(format_time(render_times[:erubi].real))}  #{dimmed(per_iteration_label(render_times[:erubi].real, RENDER_ITERATIONS, "render"))}  #{dimmed("(baseline)")}"
      herb_render_styled = herb_render_label.include?("slower") ? bold(red(herb_render_label)) : dimmed(herb_render_label)
      puts "  #{"Herb via ActionView".ljust(LABEL_WIDTH)} #{bar(render_times[:herb].real / max_render)}  #{bold(format_time(render_times[:herb].real))}  #{dimmed(per_iteration_label(render_times[:herb].real, RENDER_ITERATIONS, "render"))}  #{herb_render_styled}"

      if herb_precompiled_render_label.include?("faster")
        puts "  #{"Herb via ActionView (precompiled helpers)".ljust(LABEL_WIDTH)} #{bar(render_times[:herb_precompiled].real / max_render)}  #{bold(green(format_time(render_times[:herb_precompiled].real)))}  #{dimmed(per_iteration_label(render_times[:herb_precompiled].real, RENDER_ITERATIONS, "render"))}  #{bold(green(herb_precompiled_render_label))}"
      elsif herb_precompiled_render_label.include?("slower")
        puts "  #{"Herb via ActionView (precompiled helpers)".ljust(LABEL_WIDTH)} #{bar(render_times[:herb_precompiled].real / max_render)}  #{bold(red(format_time(render_times[:herb_precompiled].real)))}  #{dimmed(per_iteration_label(render_times[:herb_precompiled].real, RENDER_ITERATIONS, "render"))}  #{bold(red(herb_precompiled_render_label))}"
      else
        puts "  #{"Herb via ActionView (precompiled helpers)".ljust(LABEL_WIDTH)} #{bar(render_times[:herb_precompiled].real / max_render)}  #{bold(format_time(render_times[:herb_precompiled].real))}  #{dimmed(per_iteration_label(render_times[:herb_precompiled].real, RENDER_ITERATIONS, "render"))}  #{dimmed(herb_precompiled_render_label)}"
      end
      puts ""

      puts "  #{bold("Compiled size:")}"
      puts "  #{"Erubi via ActionView".ljust(LABEL_WIDTH)} #{erubi_compiled.length} bytes"
      puts "  #{"Herb via ActionView".ljust(LABEL_WIDTH)} #{reactionview_without.length} bytes"

      size_ratio = reactionview_with.length.to_f / erubi_compiled.length
      size_label = format_size_ratio(size_ratio)

      if size_label.include?("smaller")
        puts "  #{"Herb via ActionView (precompiled helpers)".ljust(LABEL_WIDTH)} #{bold(green("#{reactionview_with.length} bytes"))} #{dimmed("(#{size_label})")}"
      elsif size_label.include?("larger")
        puts "  #{"Herb via ActionView (precompiled helpers)".ljust(LABEL_WIDTH)} #{bold(red("#{reactionview_with.length} bytes"))} #{bold(red("(#{size_label})"))}"
      else
        puts "  #{"Herb via ActionView (precompiled helpers)".ljust(LABEL_WIDTH)} #{reactionview_with.length} bytes #{dimmed("(#{size_label})")}"
      end
      puts ""

      if break_even_renders
        break_even_label = break_even_renders <= 1 ? "immediate (1 render)" : "#{break_even_renders} renders"
        puts "  #{bold("Break-even:")} #{break_even_label} to amortize compile overhead"
      else
        puts "  #{bold("Break-even:")} #{dimmed("N/A (precompiled is not faster at render time)")}"
      end
      puts ""

      return unless results

      results << {
        title: title,
        lines: template.lines.count,
        helpers: helper_count,
        locals: locals.size,
        compile_slower: herb_precompiled_compile_ratio,
        render_speedup: herb_precompiled_render_ratio,
        size_ratio: reactionview_with.length.to_f / erubi_compiled.length,
        break_even_renders: break_even_renders,
        outputs_match: outputs_match,
        whitespace_only_mismatch: whitespace_only_mismatch,
        erubi_compile_avg: compile_times[:erubi].real / COMPILE_ITERATIONS,
        herb_precompiled_compile_avg: compile_times[:herb_precompiled].real / COMPILE_ITERATIONS,
        erubi_render_avg: render_times[:erubi].real / RENDER_ITERATIONS,
        herb_precompiled_render_avg: render_times[:herb_precompiled].real / RENDER_ITERATIONS,
      }
    end

    def print_summary(results)
      return if results.empty?

      sorted = results.sort_by { |result| result[:render_speedup] }
      has_semantic_mismatches = sorted.any? { |result| !result[:outputs_match] && !result[:whitespace_only_mismatch] }
      has_whitespace_mismatches = sorted.any? { |result| result[:whitespace_only_mismatch] }

      green_style = Lipgloss::Style.new.bold(true).foreground("2").padding(0, 1).align(Lipgloss::RIGHT)
      dimmed_style = Lipgloss::Style.new.foreground("8").padding(0, 1).align(Lipgloss::RIGHT)
      right_style = Lipgloss::Style.new.padding(0, 1).align(Lipgloss::RIGHT)
      normal_style = Lipgloss::Style.new.padding(0, 1)

      table = Lipgloss::Table.new
                             .headers(["Template", "Lines", "Helpers", "Compile (Erubi/Herb)", "Compile cost", "Compiled size", "Render (Erubi/Herb)", "Render gain", "Break-even"])
                             .border(Lipgloss::ROUNDED_BORDER)
                             .border_style(Lipgloss::Style.new.foreground("#555555"))
                             .style_func(rows: sorted.size, columns: 9) { |_row, column|
        case column
        when 7 then green_style
        when 4, 5 then dimmed_style
        when 1, 2, 3, 6, 8 then right_style
        else normal_style
        end
      }

      sorted.each do |result|
        render_label = format_ratio(result[:render_speedup])
        compile_label = format_compile_ratio(result[:compile_slower])
        size_label = format_size_ratio(result[:size_ratio])
        break_even_label = format_break_even(result[:break_even_renders])

        title_label = if result[:outputs_match]
                        result[:title]
                      elsif result[:whitespace_only_mismatch]
                        "#{result[:title]} ~"
                      else
                        "#{result[:title]} *"
                      end

        compile_times_label = "#{format_time(result[:erubi_compile_avg])} / #{format_time(result[:herb_precompiled_compile_avg])}"
        render_times_label = "#{format_time(result[:erubi_render_avg])} / #{format_time(result[:herb_precompiled_render_avg])}"

        table.row([
                    title_label,
                    result[:lines].to_s,
                    result[:helpers].to_s,
                    compile_times_label,
                    compile_label,
                    size_label,
                    render_times_label,
                    render_label,
                    break_even_label
                  ])
      end

      title = Lipgloss::Style.new.bold(true).padding(0, 1)
                             .render("Herb via ActionView (precompiled helpers) vs Erubi via ActionView")

      puts ""
      puts "  #{title}"
      puts ""
      puts table.render.lines.map { |line| "  #{line}" }.join

      if has_semantic_mismatches || has_whitespace_mismatches
        puts ""
        puts "  #{dimmed("* Semantic HTML differences from Erubi")}" if has_semantic_mismatches
        puts "  #{dimmed("~ Whitespace-only differences from Erubi (semantically identical)")}" if has_whitespace_mismatches
      end

      puts ""
    end
  end
end
