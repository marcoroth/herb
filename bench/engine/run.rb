# frozen_string_literal: true

# Benchmarks Herb::Engine against Erubi::Engine on compile-time work
# (ERB source -> Ruby source) over the marcoroth/herb-corpus corpus.
#
# Usage:
#   ruby bench/engine/run.rb              # cold corpus scan
#   BENCH_LIMIT=500 ruby bench/engine/run.rb
#
# Each engine is timed in its own subprocess, so one-time require / JIT /
# GC-warmup costs from one engine cannot bias the other. The two runs
# execute over the same "intersection" file set: only files that both
# engines can compile without raising are included in the timed set, so
# neither engine gets credit for skipping work.
#
# The corpus is fetched into bench/tmp/herb-corpus/ on first run and reused
# after that; it is never committed.
_TMP_FILE_LIST = nil

$LOAD_PATH.unshift(File.expand_path("../..", __dir__))
$LOAD_PATH.unshift(File.expand_path("../../lib", __dir__))

require "fileutils"
require "json"
require "open3"

require "bench/support/corpus"
require "bench/support/reporter"

module Bench
  module Engine
    include Reporter

    module_function

    WORKER    = File.expand_path("worker.rb", __dir__)
    TMP_DIR   = File.expand_path("../tmp", __dir__)
    LIST_PATH = File.join(TMP_DIR, "engine-shared-files.txt")

    ENGINES = %w[erubi herb herb-locations].freeze

    LABELS = {
      "erubi"          => "Erubi::Engine",
      "herb"           => "Herb::Engine (track_locations: false)",
      "herb-locations" => "Herb::Engine (track_locations: true)",
    }.freeze

    def run
      limit = ENV["BENCH_LIMIT"]&.to_i
      files = Corpus.files
      files = files.first(limit) if limit && limit.positive?

      puts
      puts Reporter.bold("Herb::Engine vs Erubi::Engine (compile)")
      puts Reporter.dim("Corpus:   #{Corpus.relative(Corpus::ERB_DIR)}")
      puts Reporter.dim("Files:    #{files.size}#{limit ? " (limited via BENCH_LIMIT=#{limit})" : ""}")
      puts Reporter.dim("Runtime:  #{RUBY_DESCRIPTION}")

      screening = screen(files)
      write_shared_list(screening[:shared])

      results = ENGINES.map { |name| [name, measure_engine(name)] }.to_h

      report(screening, results)
    end

    # Pre-pass: attempt to compile every corpus file with BOTH engines and
    # keep only the set that succeeds in both. This intersection is what
    # gets timed. The screening pass itself is NOT timed — its purpose is
    # to guarantee neither engine gets credit for silently skipping files
    # the other one had to compile.
    def screen(files)
      Reporter.header("Screening: files both engines can compile")

      require "erubi"
      require "herb"
      require "herb/engine"

      shared      = []
      erubi_only  = []
      herb_only   = []
      both_failed = []

      files.each_with_index do |path, i|
        src = File.read(path)
        erubi_ok = safe_compile { Erubi::Engine.new(src) }
        herb_ok  = safe_compile { Herb::Engine.new(src) }

        if erubi_ok && herb_ok
          shared << path
        elsif erubi_ok
          erubi_only << path
        elsif herb_ok
          herb_only << path
        else
          both_failed << path
        end

        report_progress(i + 1, files.size) if ((i + 1) % 2000).zero?
      end
      report_progress(files.size, files.size)
      puts

      Reporter.kv("Compilable by both",  "#{shared.size} (#{pct(shared.size, files.size)})")
      Reporter.kv("Erubi only",          "#{erubi_only.size} (#{pct(erubi_only.size, files.size)})")
      Reporter.kv("Herb only",           "#{herb_only.size} (#{pct(herb_only.size, files.size)})")
      Reporter.kv("Neither engine",      "#{both_failed.size} (#{pct(both_failed.size, files.size)})")

      dump_list(:erubi_only,  erubi_only)
      dump_list(:herb_only,   herb_only)
      dump_list(:both_failed, both_failed)

      { shared: shared, erubi_only: erubi_only, herb_only: herb_only, both_failed: both_failed, total: files.size }
    end

    def safe_compile
      yield
      true
    rescue StandardError, SyntaxError
      false
    end

    def report_progress(done, total)
      $stderr.print("\r  screened #{done}/#{total}")
      $stderr.flush
      $stderr.print("\n") if done == total
    end

    def pct(n, total)
      return "0%" if total.zero?

      format("%.1f%%", 100.0 * n / total)
    end

    def dump_list(name, files)
      return if files.empty?

      out = File.join(TMP_DIR, "engine-#{name}.txt")
      FileUtils.mkdir_p(TMP_DIR)
      File.write(out, files.join("\n"))
      puts Reporter.dim("  #{name} list written to #{Corpus.relative(out)}")
    end

    def write_shared_list(shared)
      FileUtils.mkdir_p(TMP_DIR)
      File.write(LIST_PATH, shared.join("\n"))
    end

    # Run one engine, in its own Ruby subprocess, over the shared file list.
    def measure_engine(name)
      Reporter.header("Timing #{LABELS[name] || name} (subprocess)")

      cmd = [RbConfig.ruby, WORKER, name, LIST_PATH]
      puts Reporter.dim("  $ #{cmd.join(" ")}")

      out, err, status = Open3.capture3(*cmd)

      unless status.success?
        warn Reporter.red("  worker for #{name} exited with #{status.exitstatus}")
        warn err
        return { error: err, elapsed: 0.0, files: 0, compiled_bytes: 0, failures: [] }
      end

      data = JSON.parse(out, symbolize_names: true)
      Reporter.kv("Elapsed",         Reporter.format_time(data[:elapsed]))
      Reporter.kv("Per file",        Reporter.format_time(data[:elapsed] / [data[:files], 1].max))
      Reporter.kv("Failures",        data[:failures].size.to_s)
      Reporter.kv("Compiled bytes",  format_bytes(data[:compiled_bytes]))
      data
    end

    def report(screening, results)
      Reporter.header("Results")

      shared_count = screening[:shared].size
      erubi          = results["erubi"]
      herb           = results["herb"]
      herb_locations = results["herb-locations"]

      Reporter.kv("Corpus files scanned",   screening[:total].to_s)
      Reporter.kv("Timed (shared) files",   shared_count.to_s)
      puts

      ENGINES.each do |name|
        r = results[name]
        label = LABELS[name]
        Reporter.kv("#{label} total",    Reporter.format_time(r[:elapsed]))
        Reporter.kv("#{label} per file", Reporter.format_time(r[:elapsed] / [shared_count, 1].max))
        Reporter.kv("#{label} bytes",    format_bytes(r[:compiled_bytes]))
        puts
      end

      Reporter.kv("Herb (locations off) vs Erubi", Reporter.format_ratio(erubi[:elapsed], herb[:elapsed]))
      Reporter.kv("Herb (locations on)  vs Erubi", Reporter.format_ratio(erubi[:elapsed], herb_locations[:elapsed]))
      Reporter.kv("Locations on vs off overhead",  Reporter.format_ratio(herb[:elapsed], herb_locations[:elapsed]))
      Reporter.kv("Output size (Herb/Erubi)",      size_ratio_label(herb[:compiled_bytes], erubi[:compiled_bytes]))

      results.each { |name, r| warn_on_late_failures(name, r[:failures]) }
    end

    def warn_on_late_failures(name, failures)
      return if failures.empty?

      puts
      puts Reporter.yellow("  Note: #{failures.size} #{name} compile failure(s) during the timed run, though the file")
      puts Reporter.yellow("  passed screening. This can happen for GC-sensitive edge cases; investigate:")
      failures.first(5).each { |(path, klass, _)| puts "    #{klass}  #{Corpus.relative(path)}" }
    end

    def size_ratio_label(candidate, baseline)
      return "n/a" if baseline.zero?

      ratio = candidate.to_f / baseline
      pct = ((ratio - 1) * 100).round(1)
      if pct.positive?
        "#{format("%.2fx", ratio)} (#{pct}% larger)"
      elsif pct.negative?
        "#{format("%.2fx", ratio)} (#{pct.abs}% smaller)"
      else
        "same"
      end
    end

    def format_bytes(bytes)
      units = %w[B KB MB GB]
      value = bytes.to_f
      unit = units.shift
      while value >= 1024 && !units.empty?
        value /= 1024
        unit = units.shift
      end
      format("%.2f %s", value, unit)
    end
  end
end

Bench::Engine.run if $PROGRAM_NAME == __FILE__
