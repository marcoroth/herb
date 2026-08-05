# frozen_string_literal: true

require_relative "benchmark_helper"

Profile = Data.define(:id, :name) do
  def to_s = "/profiles/#{id}"
  def model_name = "Profile"
end

module Bench
  class ActionViewBenchmarkTest < Minitest::Spec
    include BenchmarkHelper

    after { puts "─" * 80 }

    RESULTS = [] # rubocop:disable Style/MutableConstant
    BENCHMARKS_DIR = File.expand_path("benchmarks", __dir__)

    Dir.glob("*.yml", base: BENCHMARKS_DIR).sort.each do |filename|
      path = File.join(BENCHMARKS_DIR, filename)
      name = File.basename(filename, ".yml").tr("_", " ")

      test name do
        benchmark = load_benchmark(path, binding_context: binding)
        run_benchmark(**benchmark, results: RESULTS)
        pass
      end
    end

    Minitest.after_run do
      next if RESULTS.empty?

      helper = Object.new.extend(BenchmarkHelper)
      helper.send(:print_summary, RESULTS)
    end
  end
end
