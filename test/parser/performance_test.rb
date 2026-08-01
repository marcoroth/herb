# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class PerformanceTest < Minitest::Spec
    test "many unclosed tags parses within timeout" do
      source = "<div>" * 100_000
      result = Herb.parse(source, timeout: 2)

      assert_instance_of Herb::AST::DocumentNode, result.value

      timeout_errors = result.errors.select { |e| e.is_a?(Herb::Errors::TimeoutError) }
      assert_empty timeout_errors
    end

    test "many matched tags parses within timeout" do
      source = "<div>x</div>" * 100_000
      result = Herb.parse(source, timeout: 2)

      assert_instance_of Herb::AST::DocumentNode, result.value

      timeout_errors = result.errors.select { |e| e.is_a?(Herb::Errors::TimeoutError) }
      assert_empty timeout_errors
    end

    test "many unclosed tags of different names parses within timeout" do
      tags = ["div", "span", "p", "a", "section", "article", "header", "footer", "main", "nav"].cycle.take(100_000)
      source = tags.map { |t| "<#{t}>" }.join
      result = Herb.parse(source, timeout: 2)

      assert_instance_of Herb::AST::DocumentNode, result.value

      timeout_errors = result.errors.select { |e| e.is_a?(Herb::Errors::TimeoutError) }
      assert_empty timeout_errors
    end

    test "tight timeout produces TimeoutError" do
      source = "<div>" * 100_000
      result = Herb.parse(source, timeout: 0.001)

      assert_instance_of Herb::AST::DocumentNode, result.value

      timeout_errors = result.errors.select { |e| e.is_a?(Herb::Errors::TimeoutError) }
      refute_empty timeout_errors
    end
  end
end
