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
    SHIM_SRC  = File.expand_path("malloc_count.c", __dir__)
    TMP_DIR   = File.expand_path("../tmp", __dir__)
    LIST_PATH = File.join(TMP_DIR, "engine-shared-files.txt")
    SHIM_LIB  = File.join(TMP_DIR, "libmalloc_count.#{RUBY_PLATFORM =~ /darwin/ ? "dylib" : "so"}")

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
      build_malloc_shim!

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
      counters_path = File.join(TMP_DIR, "native-#{name}.json")
      File.delete(counters_path) if File.exist?(counters_path)

      env = malloc_shim_env(counters_path)
      pretty_env = env.map { |k, v| "#{k}=#{Corpus.relative(v)}" }.join(" ")
      puts Reporter.dim("  $ #{pretty_env} #{cmd.join(" ")}")

      out, err, status = Open3.capture3(env, *cmd)

      unless status.success?
        warn Reporter.red("  worker for #{name} exited with #{status.exitstatus}")
        warn err
        return { error: err, elapsed: 0.0, files: 0, compiled_bytes: 0, failures: [] }
      end

      data   = JSON.parse(out, symbolize_names: true)
      native = read_native_counters(counters_path)
      data[:native] = native

      files_timed = [data[:files], 1].max
      Reporter.kv("Elapsed",           Reporter.format_time(data[:elapsed]))
      Reporter.kv("Per file",          Reporter.format_time(data[:elapsed] / files_timed))
      Reporter.kv("Failures",          data[:failures].size.to_s)
      Reporter.kv("Compiled bytes",    format_bytes(data[:compiled_bytes]))
      Reporter.kv("Ruby objects",      format_count(data[:allocated_objects]))
      Reporter.kv("Ruby obj/file",     format_count(data[:allocated_objects] / files_timed))
      if native
        Reporter.kv("Native malloc calls",  format_count(native[:calls]))
        Reporter.kv("Native malloc bytes",  format_bytes(native[:bytes]))
        Reporter.kv("Native bytes/file",    format_bytes(native[:bytes] / files_timed))
      else
        Reporter.kv("Native malloc",  Reporter.yellow("(shim not loaded — see warning above)"))
      end
      data
    end

    # ---- native malloc shim ------------------------------------------------

    # Builds bench/tmp/libmalloc_count.{dylib,so} if it doesn't exist yet
    # (or the source is newer). Compiled with -O2 -fPIC. Shim is portable
    # C11; on macOS it uses __interpose, on Linux LD_PRELOAD + dlsym.
    def build_malloc_shim!
      return if File.exist?(SHIM_LIB) && File.mtime(SHIM_LIB) >= File.mtime(SHIM_SRC)

      FileUtils.mkdir_p(TMP_DIR)
      Reporter.header("Building native-malloc counter shim")
      puts Reporter.dim("  #{Corpus.relative(SHIM_SRC)} -> #{Corpus.relative(SHIM_LIB)}")

      cc = ENV["CC"] || "cc"
      flags =
        if RUBY_PLATFORM =~ /darwin/
          %w[-O2 -std=c11 -dynamiclib]
        else
          %w[-O2 -std=c11 -fPIC -shared -ldl]
        end

      cmd = [cc, *flags, SHIM_SRC, "-o", SHIM_LIB]
      _out, err, status = Open3.capture3(*cmd)
      unless status.success?
        warn Reporter.red("  Failed to build malloc shim:")
        warn err
        FileUtils.rm_f(SHIM_LIB)
        return
      end
      puts Reporter.dim("  built ok")
    end

    def malloc_shim_env(counters_path)
      return {} unless File.exist?(SHIM_LIB)

      preload_var = RUBY_PLATFORM =~ /darwin/ ? "DYLD_INSERT_LIBRARIES" : "LD_PRELOAD"
      { preload_var => SHIM_LIB, "MALLOC_COUNT_OUT" => counters_path }
    end

    def read_native_counters(path)
      return nil unless File.exist?(path)

      JSON.parse(File.read(path), symbolize_names: true)
    rescue JSON::ParserError
      nil
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
        Reporter.kv("#{label} total",      Reporter.format_time(r[:elapsed]))
        Reporter.kv("#{label} per file",   Reporter.format_time(r[:elapsed] / [shared_count, 1].max))
        Reporter.kv("#{label} out bytes",  format_bytes(r[:compiled_bytes]))
        Reporter.kv("#{label} Ruby objs",  format_count(r[:allocated_objects]))
        Reporter.kv("#{label} Ruby obj/file", format_count(r[:allocated_objects] / [shared_count, 1].max))
        if r[:native]
          Reporter.kv("#{label} native calls",     format_count(r[:native][:calls]))
          Reporter.kv("#{label} native bytes",     format_bytes(r[:native][:bytes]))
          Reporter.kv("#{label} native bytes/file", format_bytes(r[:native][:bytes] / [shared_count, 1].max))
        end
        puts
      end

      Reporter.kv("Herb (locations off) vs Erubi", Reporter.format_ratio(erubi[:elapsed], herb[:elapsed]))
      Reporter.kv("Herb (locations on)  vs Erubi", Reporter.format_ratio(erubi[:elapsed], herb_locations[:elapsed]))
      Reporter.kv("Locations on vs off overhead",  Reporter.format_ratio(herb[:elapsed], herb_locations[:elapsed]))
      Reporter.kv("Output size (Herb/Erubi)",      size_ratio_label(herb[:compiled_bytes], erubi[:compiled_bytes]))
      Reporter.kv("Ruby objs (Herb off / Erubi)",  count_ratio(herb[:allocated_objects],           erubi[:allocated_objects]))
      Reporter.kv("Ruby objs (Herb on  / Erubi)",  count_ratio(herb_locations[:allocated_objects], erubi[:allocated_objects]))
      Reporter.kv("Ruby objs (Herb on / off)",     count_ratio(herb_locations[:allocated_objects], herb[:allocated_objects]))
      if erubi[:native] && herb[:native] && herb_locations[:native]
        Reporter.kv("Native bytes (Herb off / Erubi)", count_ratio(herb[:native][:bytes],           erubi[:native][:bytes]))
        Reporter.kv("Native bytes (Herb on  / Erubi)", count_ratio(herb_locations[:native][:bytes], erubi[:native][:bytes]))
        Reporter.kv("Native bytes (Herb on / off)",    count_ratio(herb_locations[:native][:bytes], herb[:native][:bytes]))
      end

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

    def format_count(n)
      # 1_234_567 -> "1,234,567"
      n.to_i.to_s.reverse.scan(/\d{1,3}/).join(",").reverse
    end

    # Plain N.NNx ratio for comparing raw counts (allocated objects,
    # compiled bytes). Doesn't tag "slower/faster" since those don't
    # apply to counts.
    def count_ratio(candidate, baseline)
      return "n/a" if baseline.to_i.zero?

      format("%.2fx", candidate.to_f / baseline)
    end
  end
end

Bench::Engine.run if $PROGRAM_NAME == __FILE__
