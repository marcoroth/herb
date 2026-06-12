# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class PerformanceTest < Minitest::Spec
    test "many unclosed tags parses without quadratic slowdown" do
      source = "<div>" * 100_000
      start = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      result = Herb.parse(source)
      elapsed = Process.clock_gettime(Process::CLOCK_MONOTONIC) - start

      assert_instance_of Herb::AST::DocumentNode, result.value
      assert elapsed < 5, "Parsing 100,000 unclosed tags took #{elapsed.round(2)}s, expected < 5s"
    end

    test "many matched tags parses quickly" do
      source = "<div>x</div>" * 100_000
      start = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      result = Herb.parse(source)
      elapsed = Process.clock_gettime(Process::CLOCK_MONOTONIC) - start

      assert_instance_of Herb::AST::DocumentNode, result.value
      assert elapsed < 5, "Parsing 100,000 matched tags took #{elapsed.round(2)}s, expected < 5s"
    end

    test "many unclosed tags of different names parses quickly" do
      tags = ["div", "span", "p", "a", "section", "article", "header", "footer", "main", "nav"].cycle.take(100_000)
      source = tags.map { |t| "<#{t}>" }.join
      start = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      result = Herb.parse(source)
      elapsed = Process.clock_gettime(Process::CLOCK_MONOTONIC) - start

      assert_instance_of Herb::AST::DocumentNode, result.value
      assert elapsed < 5, "Parsing 100,000 mixed unclosed tags took #{elapsed.round(2)}s, expected < 5s"
    end
  end
end
