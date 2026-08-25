# frozen_string_literal: true

# One-shot worker used by bench/engine/run.rb. Runs in its own Ruby process
# so the two engines never share GC state, method cache, or one-time
# require/JIT costs. Times a cold compile over the given file list and
# writes a JSON result to stdout.
#
#   ruby bench/engine/worker.rb <engine> <file-list-path>
#
# where <engine> is "erubi" or "herb" and <file-list-path> is a newline-
# delimited list of absolute paths.

require "benchmark"
require "json"

engine_name = ARGV[0]
list_path   = ARGV[1]

abort "usage: worker.rb <erubi|herb> <file-list>" unless engine_name && list_path

case engine_name
when "erubi"
  require "erubi"
  compile = ->(src) { Erubi::Engine.new(src) }
when "herb"
  require "herb"
  require "herb/engine"
  # Herb::Engine defaults to track_locations: false; be explicit so the
  # bench doesn't silently change if the default shifts.
  compile = ->(src) { Herb::Engine.new(src, parser_options: { track_locations: false }) }
when "herb-locations"
  require "herb"
  require "herb/engine"
  compile = ->(src) { Herb::Engine.new(src, parser_options: { track_locations: true }) }
else
  abort "unknown engine: #{engine_name}"
end

files = File.readlines(list_path, chomp: true).reject(&:empty?)

# Load sources into memory before timing so file I/O doesn't skew the
# measurement.
sources = files.map { |path| [path, File.read(path)] }

failures = []
compiled_bytes = 0

elapsed = Benchmark.realtime do
  sources.each do |(path, src)|
    engine = compile.call(src)
    compiled_bytes += engine.src.bytesize if engine.respond_to?(:src) && engine.src
  rescue StandardError, SyntaxError => e
    failures << [path, e.class.name, e.message.lines.first&.strip]
  end
end

STDOUT.write(JSON.generate(
  engine: engine_name,
  files: sources.size,
  elapsed: elapsed,
  compiled_bytes: compiled_bytes,
  failures: failures,
))
