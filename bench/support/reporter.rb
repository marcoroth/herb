# frozen_string_literal: true

module Bench
  # Tiny formatting helpers shared by the linter and engine benches. Kept
  # dependency-free so the benches can be run without extra gems.
  module Reporter
    module_function

    def bold(str)   = "\e[1m#{str}\e[0m"
    def dim(str)    = "\e[2m#{str}\e[0m"
    def green(str)  = "\e[32m#{str}\e[0m"
    def red(str)    = "\e[31m#{str}\e[0m"
    def yellow(str) = "\e[33m#{str}\e[0m"

    def format_time(seconds)
      if seconds < 0.001
        format("%.1fµs", seconds * 1_000_000)
      elsif seconds < 1
        format("%.2fms", seconds * 1000)
      elsif seconds < 60
        format("%.2fs", seconds)
      else
        minutes = (seconds / 60).floor
        format("%<minutes>dm%<seconds>.1fs", minutes: minutes, seconds: seconds - (minutes * 60))
      end
    end

    def format_ratio(baseline, candidate)
      return "n/a" if baseline.zero? || candidate.zero?

      if candidate < baseline
        format("%.2fx faster", baseline / candidate)
      elsif candidate > baseline
        format("%.2fx slower", candidate / baseline)
      else
        "same"
      end
    end

    def header(text)
      puts
      puts bold(text)
      puts dim("─" * text.length)
    end

    def kv(label, value, width: 32)
      puts "  #{label.ljust(width)} #{value}"
    end
  end
end
