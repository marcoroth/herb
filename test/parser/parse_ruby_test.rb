# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class ParseRubyTest < Minitest::Spec
    include SnapshotUtils

    test "parse_ruby simple expression" do
      assert_parsed_ruby_snapshot("1 + 2")
    end

    test "parse_ruby class definition" do
      assert_parsed_ruby_snapshot("class Foo; end")
    end

    test "parse_ruby method definition" do
      assert_parsed_ruby_snapshot("def greet(name)\n  \"Hello, \#{name}!\"\nend")
    end

    test "parse_ruby variable assignment" do
      assert_parsed_ruby_snapshot("x = 1 + 2")
    end

    private

    def assert_parsed_ruby_snapshot(source)
      result = Herb.parse_ruby(source)
      assert_instance_of ::Prism::ParseResult, result
      assert_equal 0, result.errors.length

      assert_snapshot_matches(result.value.inspect, source)
    end
  end
end
