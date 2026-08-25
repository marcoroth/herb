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

failures = []
compiled_bytes = 0

GC.start
allocated_objects_before = GC.stat(:total_allocated_objects)

# I/O is intentionally inside the timed loop: reading + compiling is the
# real cost per file, and we want the bench to reflect optimizations that
# affect either side (e.g. streaming the parser, avoiding a full string
# copy of the source).
elapsed = Benchmark.realtime do
  files.each do |path|
    src = File.read(path)
    engine = compile.call(src)
    compiled_bytes += engine.src.bytesize if engine.respond_to?(:src) && engine.src
  rescue StandardError, SyntaxError => e
    failures << [path, e.class.name, e.message.lines.first&.strip]
  end
end

allocated_objects = GC.stat(:total_allocated_objects) - allocated_objects_before

$stdout.write(JSON.generate(
                engine: engine_name,
                files: files.size,
                elapsed: elapsed,
                compiled_bytes: compiled_bytes,
                allocated_objects: allocated_objects,
                failures: failures
              ))
