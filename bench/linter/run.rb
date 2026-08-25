# frozen_string_literal: true

# Benchmarks @herb-tools/linter against Shopify/erb_lint on the equivalent set
# of rules, over the marcoroth/herb-corpus corpus.
#
# Usage:
#   ruby bench/linter/run.rb
#
# Assumes:
#   - Node is on PATH (herb-lint is invoked via node javascript/packages/linter/bin/herb-lint)
#   - @herb-tools/linter has been built (dist/ exists). If not, the script
#     prints a hint and exits.
#   - Ruby + Bundler are available. erb_lint is installed on demand into
#     bench/linter/vendor/ from bench/linter/Gemfile.

$LOAD_PATH.unshift(File.expand_path("../..", __dir__))

require "benchmark"
require "fileutils"
require "json"
require "open3"

require "bench/support/corpus"
require "bench/support/reporter"

module Bench
  module Linter
    include Reporter

    module_function

    REPO_ROOT       = File.expand_path("../..", __dir__)
    BENCH_DIR       = File.expand_path("..", __dir__)
    LINTER_DIR      = __dir__
    HERB_LINT_BIN   = File.join(REPO_ROOT, "javascript/packages/linter/bin/herb-lint")
    HERB_LINT_DIST  = File.join(REPO_ROOT, "javascript/packages/linter/dist")
    HERB_CONFIG     = File.join(LINTER_DIR, ".herb.yml")
    ERB_LINT_CONFIG = File.join(LINTER_DIR, ".erb_lint.yml")
    GEMFILE         = File.join(LINTER_DIR, "Gemfile")
    BUNDLE_PATH     = File.join(LINTER_DIR, "vendor/bundle")

    # Single source of truth for the equivalence set. Update this AND the
    # .erb_lint.yml linters block together.
    RULE_MAP = {
      "html-allowed-script-type"        => "AllowedScriptType",
      "erb-comment-syntax"              => "CommentSyntax",
      "erb-no-extra-newline"            => "ExtraNewline",
      "erb-require-trailing-newline"    => "FinalNewline",
      "erb-no-javascript-tag-helper"    => "NoJavascriptTagHelper",
      "parser-no-errors"                => "ParserErrors",
      "html-input-require-autocomplete" => "RequireInputAutocomplete",
      "html-require-script-nonce"       => "RequireScriptNonce",
      "erb-right-trim"                  => "RightTrim",
      "html-no-self-closing"            => "SelfClosingTag",
      "erb-no-trailing-whitespace"      => "TrailingWhitespace",
    }.freeze

    def run
      corpus_root = Corpus.ensure!

      sample_fraction = (ENV["BENCH_LINTER_SAMPLE"] || "0.10").to_f
      sample_seed     = (ENV["BENCH_LINTER_SEED"] || "1").to_i

      Reporter.header("Herb Linter vs erb_lint")
      puts "  Corpus: #{Corpus.relative(corpus_root)}"
      puts "  Rules:  #{RULE_MAP.size} equivalent rules"

      preflight!

      sample = build_sample(corpus_root, sample_fraction, sample_seed)

      herb_result     = run_herb_lint(corpus_root, sample)
      erb_lint_result = run_erb_lint(corpus_root, sample)

      report(herb_result, erb_lint_result)
    end

    # Deterministically pick a fraction of the corpus so both linters lint
    # exactly the same files. Written to bench/tmp/linter-sample.txt for
    # inspection and cross-run reuse.
    def build_sample(corpus_root, fraction, seed)
      all = Dir.glob("**/*.{erb,rhtml,herb}", base: corpus_root).sort
      count = [(all.size * fraction).round, 1].max
      shuffled = all.shuffle(random: Random.new(seed))
      picked = shuffled.first(count).sort
      absolute = picked.map { |rel| File.join(corpus_root, rel) }

      out = File.expand_path("../tmp/linter-sample.txt", __dir__)
      FileUtils.mkdir_p(File.dirname(out))
      File.write(out, absolute.join("\n"))

      Reporter.kv("Sample",
                  "#{picked.size} of #{all.size} files " \
                  "(#{format("%.1f%%", fraction * 100)}, seed=#{seed})")
      Reporter.kv("Sample list", Corpus.relative(out))
      puts
      { relative: picked, absolute: absolute, list_path: out }
    end

    def preflight!
      unless File.executable?(HERB_LINT_BIN)
        abort_with_hint(<<~MSG)
          herb-lint binary not found at #{Corpus.relative(HERB_LINT_BIN)}.
          This is a repo file; check that you're running from the repo root.
        MSG
      end

      unless File.directory?(HERB_LINT_DIST)
        abort_with_hint(<<~MSG)
          The @herb-tools/linter package hasn't been built.
          Run:
            yarn workspace @herb-tools/linter build
        MSG
      end

      ensure_erb_lint_bundle!
    end

    def ensure_erb_lint_bundle!
      # Idempotent: skips install when the bundle is already resolved for
      # this Gemfile.
      env = { "BUNDLE_GEMFILE" => GEMFILE, "BUNDLE_PATH" => BUNDLE_PATH }
      out, status = Open3.capture2e(env, "bundle", "check")
      return if status.success?

      warn "==> Installing erb_lint into #{Corpus.relative(BUNDLE_PATH)} ..."
      out, status = Open3.capture2e(env, "bundle", "install", "--quiet")
      return if status.success?

      abort_with_hint(<<~MSG)
        Failed to install erb_lint. Bundler output:

        #{out}
      MSG
    end

    def abort_with_hint(msg)
      warn Reporter.red("Error:")
      warn msg
      exit 1
    end

    # ---- herb-lint ---------------------------------------------------------

    def run_herb_lint(corpus_root, sample)
      Reporter.header("Running @herb-tools/linter")

      cmd = [
        "node", HERB_LINT_BIN,
        *sample[:relative],
        "--config-file", HERB_CONFIG,
        "--only", RULE_MAP.keys.join(","),
        "--json",
        "--no-color",
        "--no-timing",
        "--fail-level", "error",
      ]

      puts "  $ node ...herb-lint <#{sample[:relative].size} paths> " \
           "--config-file #{Corpus.relative(HERB_CONFIG)} --only <rules> --json"

      out_path = File.expand_path("../tmp/herb-lint.out", __dir__)
      err_path = File.expand_path("../tmp/herb-lint.err", __dir__)
      FileUtils.mkdir_p(File.dirname(out_path))

      # Stream stdout/stderr directly to disk rather than buffering via
      # Open3.capture3 — for large corpora the child emits multi-MB of JSON
      # and some Ruby builds truncate captured strings that large.
      elapsed = nil
      File.open(out_path, "w") do |out_io|
        File.open(err_path, "w") do |err_io|
          elapsed = Benchmark.realtime do
            pid = spawn(*cmd, chdir: corpus_root, out: out_io, err: err_io)
            Process.wait(pid)
          end
        end
      end

      out = File.read(out_path)
      err = File.read(err_path)

      offenses = parse_herb_offenses(out, err)
      Reporter.kv("Elapsed",     Reporter.format_time(elapsed))
      Reporter.kv("Offenses",    offenses[:total].to_s)
      Reporter.kv("Raw stdout",  Corpus.relative(out_path))

      { elapsed: elapsed, offenses: offenses, stdout: out, stderr: err }
    end

    def parse_herb_offenses(stdout, stderr)
      data = JSON.parse(extract_json(stdout))
      per_rule = Hash.new(0)
      total = 0

      # herb-lint --json emits { offenses: [...], summary: {...} }.
      # Older shapes exposed a `files` array; support both.
      if data.is_a?(Hash) && data["offenses"].is_a?(Array)
        data["offenses"].each do |off|
          rule = off["code"] || off["rule"] || off["source"] || "unknown"
          per_rule[rule] += 1
          total += 1
        end
      elsif data.is_a?(Hash) && data["files"].is_a?(Array)
        data["files"].each do |file|
          Array(file["offenses"] || file["diagnostics"]).each do |off|
            rule = off["code"] || off["rule"] || off["source"] || "unknown"
            per_rule[rule] += 1
            total += 1
          end
        end
      end

      { total: total, per_rule: per_rule }
    rescue JSON::ParserError => e
      warn Reporter.yellow("  Warning: could not parse herb-lint JSON output: #{e.message}")
      warn "  stderr snippet: #{stderr[0, 400]}" if stderr
      { total: 0, per_rule: {} }
    end

    # ---- erb_lint ----------------------------------------------------------

    def run_erb_lint(corpus_root, sample)
      Reporter.header("Running Shopify/erb_lint")

      env = { "BUNDLE_GEMFILE" => GEMFILE, "BUNDLE_PATH" => BUNDLE_PATH }
      cmd = [
        "bundle", "exec", "erb_lint",
        "--config", ERB_LINT_CONFIG,
        "--format", "json",
        *sample[:relative],
      ]

      puts "  $ BUNDLE_GEMFILE=#{Corpus.relative(GEMFILE)} bundle exec erb_lint " \
           "--config #{Corpus.relative(ERB_LINT_CONFIG)} --format json <#{sample[:relative].size} paths>"

      out_path = File.expand_path("../tmp/erb_lint.out", __dir__)
      err_path = File.expand_path("../tmp/erb_lint.err", __dir__)
      FileUtils.mkdir_p(File.dirname(out_path))

      elapsed = nil
      File.open(out_path, "w") do |out_io|
        File.open(err_path, "w") do |err_io|
          elapsed = Benchmark.realtime do
            pid = spawn(env, *cmd, chdir: corpus_root, out: out_io, err: err_io)
            Process.wait(pid)
          end
        end
      end

      out = File.read(out_path)
      err = File.read(err_path)

      offenses = parse_erb_lint_offenses(out, err)
      Reporter.kv("Elapsed",    Reporter.format_time(elapsed))
      Reporter.kv("Offenses",   offenses[:total].to_s)
      Reporter.kv("Raw stdout", Corpus.relative(out_path))

      { elapsed: elapsed, offenses: offenses, stdout: out, stderr: err }
    end

    def parse_erb_lint_offenses(stdout, stderr)
      # erb_lint --format json prints one JSON object per run with a
      # `summary.offenses` count and `files` array. Under some Ruby versions
      # it also emits a `parser/current` compatibility warning to stdout
      # before the JSON, so strip anything before the first `{` / `[`.
      data = JSON.parse(extract_json(stdout))
      per_rule = Hash.new(0)
      total = 0
      Array(data["files"]).each do |file|
        Array(file["offenses"]).each do |off|
          rule = off["linter"] || off["cop_name"] || "unknown"
          per_rule[rule] += 1
          total += 1
        end
      end
      total = data.dig("summary", "offenses") if total.zero? && data.is_a?(Hash)
      { total: total.to_i, per_rule: per_rule }
    rescue JSON::ParserError => e
      warn Reporter.yellow("  Warning: could not parse erb_lint JSON output: #{e.message}")
      warn "  stderr snippet: #{stderr[0, 400]}" if stderr
      { total: 0, per_rule: {} }
    end

    # ---- report ------------------------------------------------------------

    # Strips anything before the first `{` or `[` so leading warnings
    # (e.g. erb_lint's `parser/current` notice, herb-lint's `MODULE_TYPELESS`
    # warnings when they leak to stdout) don't break `JSON.parse`.
    def extract_json(str)
      return "{}" if str.nil? || str.empty?

      idx = str.index(/[{\[]/)
      idx ? str[idx..] : str
    end

    def report(herb, erb_lint)
      Reporter.header("Summary")

      Reporter.kv("Herb linter elapsed", Reporter.format_time(herb[:elapsed]))
      Reporter.kv("erb_lint elapsed",    Reporter.format_time(erb_lint[:elapsed]))
      Reporter.kv("Herb vs erb_lint",    Reporter.format_ratio(erb_lint[:elapsed], herb[:elapsed]))
      puts
      Reporter.kv("Herb offenses",       herb[:offenses][:total].to_s)
      Reporter.kv("erb_lint offenses",   erb_lint[:offenses][:total].to_s)

      puts
      puts Reporter.bold("  Per-rule offenses")
      printf("  %-42s %10s   %10s\n", "rule (herb / erb_lint)", "herb", "erb_lint")
      RULE_MAP.each do |herb_rule, erb_lint_rule|
        h = herb[:offenses][:per_rule][herb_rule] || 0
        e = erb_lint[:offenses][:per_rule][erb_lint_rule] || 0
        pair = "#{herb_rule} / #{erb_lint_rule}"
        printf("  %-42s %10d   %10d\n", pair.length > 42 ? "#{pair[0, 39]}..." : pair, h, e)
      end
      puts
    end
  end
end

Bench::Linter.run if $PROGRAM_NAME == __FILE__
