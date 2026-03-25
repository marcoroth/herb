# frozen_string_literal: true

require "benchmark"
require "lipgloss"
require "reactionview/template/handlers/herb/herb"

require_relative "../../test/engine/action_view/action_view_test_helper"

module Bench
  module BenchmarkHelper
    include Engine::ActionViewTestHelper

    LABEL_WIDTH = 50
    RENDER_ITERATIONS = 1000
    COMPILE_ITERATIONS = 100

    private

    def bold(str)    = "\e[1m#{str}\e[0m"
    def dimmed(str)  = "\e[2m#{str}\e[0m"
    def green(str)   = "\e[32m#{str}\e[0m"
    def red(str)     = "\e[31m#{str}\e[0m"

    class ActionViewHelperCounter < Herb::Visitor
      attr_reader :count

      def initialize
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

    def bar(ratio, width: 40)
      filled = [(ratio * width).round, width].min
      "#{green("█" * filled)}#{dimmed("░" * (width - filled))}"
    end

    def format_time(seconds)
      if seconds < 0.001
        "%.1fµs" % (seconds * 1_000_000)
      elsif seconds < 1
        "%.2fms" % (seconds * 1000)
      else
        "%.2fs" % seconds
      end
    end

    def format_ratio(ratio, faster_threshold: 1.05, slower_threshold: 0.95)
      if ratio > faster_threshold
        ratio >= 2.0 ? "%.0fx faster" % ratio : "%.1fx faster" % ratio
      elsif ratio < slower_threshold
        (1.0 / ratio) >= 2.0 ? "%.0fx slower" % (1.0 / ratio) : "%.1fx slower" % (1.0 / ratio)
      else
        "~baseline"
      end
    end

    def format_compile_ratio(ratio)
      ratio < 1.1 ? "~baseline" : "%.1fx slower" % ratio
    end

    def run_benchmark(title:, template:, locals: {}, subtitle: nil, fixture: nil, results: nil)
      parse_result = Herb.parse(template, action_view_helpers: true)
      helper_count = count_action_view_helpers(parse_result.value)

      compile_times = {}

      Benchmark.bm(1) do |x|
        compile_times[:erubi] = x.report("") { COMPILE_ITERATIONS.times { ::ActionView::Template::Handlers::ERB::Erubi.new(template) } }
        compile_times[:herb] = x.report("") { COMPILE_ITERATIONS.times { ReActionView::Template::Handlers::Herb::Herb.new(template, action_view_helpers: false) } }
        compile_times[:herb_pre] = x.report("") { COMPILE_ITERATIONS.times { ReActionView::Template::Handlers::Herb::Herb.new(template, action_view_helpers: true) } }
      end

      reactionview_with = ReActionView::Template::Handlers::Herb::Herb.new(template, action_view_helpers: true).src
      reactionview_without = ReActionView::Template::Handlers::Herb::Herb.new(template, action_view_helpers: false).src
      erubi_compiled = ::ActionView::Template::Handlers::ERB::Erubi.new(template).src

      local_assigns_code = locals.map { |k, _| "#{k} = local_assigns[:#{k}]" }.join("; ")
      local_prefix = locals.empty? ? "" : "#{local_assigns_code}; "

      context_erubi = action_view_context
      context_without = action_view_context
      context_with = action_view_context

      if locals.empty?
        context_erubi.instance_eval("def _erubi; @output_buffer = ::ActionView::OutputBuffer.new; #{erubi_compiled}; end")
        context_without.instance_eval("def _herb; @output_buffer = ::ActionView::OutputBuffer.new; #{reactionview_without}; end")
        context_with.instance_eval("def _herb_pre; @output_buffer = ::ActionView::OutputBuffer.new; #{reactionview_with}; end")
      else
        context_erubi.instance_eval("def _erubi(local_assigns); @output_buffer = ::ActionView::OutputBuffer.new; #{local_prefix}#{erubi_compiled}; end")
        context_without.instance_eval("def _herb(local_assigns); @output_buffer = ::ActionView::OutputBuffer.new; #{local_prefix}#{reactionview_without}; end")
        context_with.instance_eval("def _herb_pre(local_assigns); @output_buffer = ::ActionView::OutputBuffer.new; #{local_prefix}#{reactionview_with}; end")
      end

      call_args = locals.empty? ? [] : [locals]

      context_erubi.send(:_erubi, *call_args)
      context_without.send(:_herb, *call_args)
      context_with.send(:_herb_pre, *call_args)

      render_times = {}

      Benchmark.bm(1) do |x|
        render_times[:erubi] = x.report("") { RENDER_ITERATIONS.times { context_erubi.send(:_erubi, *call_args) } }
        render_times[:herb] = x.report("") { RENDER_ITERATIONS.times { context_without.send(:_herb, *call_args) } }
        render_times[:herb_pre] = x.report("") { RENDER_ITERATIONS.times { context_with.send(:_herb_pre, *call_args) } }
      end

      baseline_render = render_times[:erubi].real
      max_render = render_times.values.map(&:real).max
      baseline_compile = compile_times[:erubi].real
      max_compile = compile_times.values.map(&:real).max

      herb_compile_ratio = compile_times[:herb].real / baseline_compile
      herb_pre_compile_ratio = compile_times[:herb_pre].real / baseline_compile
      herb_render_ratio = baseline_render / render_times[:herb].real
      herb_pre_render_ratio = baseline_render / render_times[:herb_pre].real

      puts ""
      puts bold("  Herb Engine Benchmark: #{title}")
      puts dimmed("  #{subtitle}") if subtitle

      if fixture
        relative = fixture.sub("#{File.expand_path("../..", __dir__)}/", "")
        puts dimmed("  File: #{relative}")
      end

      puts dimmed("  Template: #{template.lines.count} lines, #{helper_count} ActionView helper calls#{", #{locals.size} locals" unless locals.empty?}")
      puts ""

      puts "  #{bold("Compile")} #{dimmed("(#{COMPILE_ITERATIONS} iterations)")}"
      puts ""
      puts "  #{"Erubi via ActionView".ljust(LABEL_WIDTH)} #{bar(compile_times[:erubi].real / max_compile, width: 20)}  #{bold(format_time(compile_times[:erubi].real))}  #{dimmed("(%s/compile)" % format_time(compile_times[:erubi].real / COMPILE_ITERATIONS))}  #{dimmed("(baseline)")}"

      herb_compile_label = format_compile_ratio(herb_compile_ratio)
      herb_pre_compile_label = format_compile_ratio(herb_pre_compile_ratio)
      herb_compile_styled = herb_compile_label.include?("slower") ? bold(red(herb_compile_label)) : dimmed(herb_compile_label)
      herb_pre_compile_styled = herb_pre_compile_label.include?("slower") ? bold(red(herb_pre_compile_label)) : dimmed(herb_pre_compile_label)

      puts "  #{"Herb via ActionView".ljust(LABEL_WIDTH)} #{bar(compile_times[:herb].real / max_compile, width: 20)}  #{bold(format_time(compile_times[:herb].real))}  #{dimmed("(%s/compile)" % format_time(compile_times[:herb].real / COMPILE_ITERATIONS))}  #{herb_compile_styled}"
      puts "  #{"Herb via ActionView (precompiled helpers)".ljust(LABEL_WIDTH)} #{bar(compile_times[:herb_pre].real / max_compile, width: 20)}  #{bold(format_time(compile_times[:herb_pre].real))}  #{dimmed("(%s/compile)" % format_time(compile_times[:herb_pre].real / COMPILE_ITERATIONS))}  #{herb_pre_compile_styled}"
      puts ""

      puts "  #{bold("Render")} #{dimmed("(#{RENDER_ITERATIONS} iterations)")}"
      puts ""

      herb_render_label = format_ratio(herb_render_ratio)
      herb_pre_render_label = format_ratio(herb_pre_render_ratio)

      puts "  #{"Erubi via ActionView".ljust(LABEL_WIDTH)} #{bar(render_times[:erubi].real / max_render)}  #{bold(format_time(render_times[:erubi].real))}  #{dimmed("(%s/render)" % format_time(render_times[:erubi].real / RENDER_ITERATIONS))}  #{dimmed("(baseline)")}"
      herb_render_styled = herb_render_label.include?("slower") ? bold(red(herb_render_label)) : dimmed(herb_render_label)
      puts "  #{"Herb via ActionView".ljust(LABEL_WIDTH)} #{bar(render_times[:herb].real / max_render)}  #{bold(format_time(render_times[:herb].real))}  #{dimmed("(%s/render)" % format_time(render_times[:herb].real / RENDER_ITERATIONS))}  #{herb_render_styled}"

      if herb_pre_render_label.include?("faster")
        puts "  #{"Herb via ActionView (precompiled helpers)".ljust(LABEL_WIDTH)} #{bar(render_times[:herb_pre].real / max_render)}  #{bold(green(format_time(render_times[:herb_pre].real)))}  #{dimmed("(%s/render)" % format_time(render_times[:herb_pre].real / RENDER_ITERATIONS))}  #{bold(green(herb_pre_render_label))}"
      elsif herb_pre_render_label.include?("slower")
        puts "  #{"Herb via ActionView (precompiled helpers)".ljust(LABEL_WIDTH)} #{bar(render_times[:herb_pre].real / max_render)}  #{bold(red(format_time(render_times[:herb_pre].real)))}  #{dimmed("(%s/render)" % format_time(render_times[:herb_pre].real / RENDER_ITERATIONS))}  #{bold(red(herb_pre_render_label))}"
      else
        puts "  #{"Herb via ActionView (precompiled helpers)".ljust(LABEL_WIDTH)} #{bar(render_times[:herb_pre].real / max_render)}  #{bold(format_time(render_times[:herb_pre].real))}  #{dimmed("(%s/render)" % format_time(render_times[:herb_pre].real / RENDER_ITERATIONS))}  #{dimmed(herb_pre_render_label)}"
      end
      puts ""

      puts "  #{bold("Compiled size:")}"
      puts "  #{"Erubi via ActionView".ljust(LABEL_WIDTH)} #{erubi_compiled.length} bytes"
      puts "  #{"Herb via ActionView".ljust(LABEL_WIDTH)} #{reactionview_without.length} bytes"

      size_change = (1 - reactionview_with.length.to_f / erubi_compiled.length) * 100

      if size_change >= 0
        size_label = "#{size_change.round}% smaller"
        puts "  #{"Herb via ActionView (precompiled helpers)".ljust(LABEL_WIDTH)} #{bold(green("#{reactionview_with.length} bytes"))} #{dimmed("(#{size_label})")}"
      else
        size_label = "#{size_change.abs.round}% larger"
        puts "  #{"Herb via ActionView (precompiled helpers)".ljust(LABEL_WIDTH)} #{bold(red("#{reactionview_with.length} bytes"))} #{bold(red("(#{size_label})"))}"
      end

      puts ""

      results << {
        title: title,
        lines: template.lines.count,
        helpers: helper_count,
        locals: locals.size,
        compile_slower: herb_pre_compile_ratio,
        render_speedup: herb_pre_render_ratio,
        size_reduction: ((1 - reactionview_with.length.to_f / erubi_compiled.length) * 100).round,
      } if results
    end

    def print_summary(results)
      return if results.empty?

      sorted = results.sort_by { |result| result[:render_speedup] }

      green_style = Lipgloss::Style.new.bold(true).foreground("2").padding(0, 1).align(Lipgloss::RIGHT)
      dimmed_style = Lipgloss::Style.new.foreground("8").padding(0, 1).align(Lipgloss::RIGHT)
      right_style = Lipgloss::Style.new.padding(0, 1).align(Lipgloss::RIGHT)
      normal_style = Lipgloss::Style.new.padding(0, 1)

      table = Lipgloss::Table.new
        .headers(["Template", "Lines", "Helpers", "Compile cost", "Compiled size", "Render gain"])
        .border(Lipgloss::ROUNDED_BORDER)
        .border_style(Lipgloss::Style.new.foreground("#555555"))
        .style_func(rows: sorted.size, columns: 6) { |_row, column|
          case column
          when 5 then green_style
          when 3, 4 then dimmed_style
          when 1, 2 then right_style
          else normal_style
          end
        }

      sorted.each do |result|
        render_label = format_ratio(result[:render_speedup], faster_threshold: 1.05, slower_threshold: 0.95)
        size_label = result[:size_reduction] >= 0 ? "#{result[:size_reduction]}% smaller" : "#{-result[:size_reduction]}% larger"

        table.row([
          result[:title],
          result[:lines].to_s,
          result[:helpers].to_s,
          result[:compile_slower] < 1.1 ? "~baseline" : "%.0fx slower" % result[:compile_slower],
          size_label,
          render_label,
        ])
      end

      title = Lipgloss::Style.new.bold(true).padding(0, 1)
        .render("Herb via ActionView (precompiled helpers) vs Erubi via ActionView")

      puts ""
      puts "  " + title
      puts ""
      puts table.render.lines.map { |line| "  " + line }.join
      puts ""
    end
  end
end
