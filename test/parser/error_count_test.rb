# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class ErrorCountTest < Minitest::Spec
    test "clean templates report a zero count" do
      result = Herb.parse(%(<div class="hello">content</div>\n))

      assert_equal 0, result.error_count
      assert_empty result.errors
    end

    test "the count matches the errors actually attached to the tree" do
      [
        "<div>",
        "<div><span>hello</div>",
        "<% if condition without end %>",
        "<% if x %>",
        "</div>" * 30,
      ].each do |source|
        result = Herb.parse(source)

        assert_equal result.value.recursive_errors.size, result.error_count, "count mismatch for #{source.inspect}"
        assert_equal result.error_count, result.errors.size
      end
    end

    test "the count includes Ruby parse errors that are attached outside the parser" do
      result = Herb.parse("<% if condition without end %>")

      assert_equal 1, result.error_count
      assert_instance_of Herb::Errors::RubyParseError, result.errors.first
    end

    test "the count respects max_errors" do
      assert_equal 25, Herb.parse("<div>" * 1000).error_count
      assert_equal 5, Herb.parse("<div>" * 1000, max_errors: 5).error_count
      assert_equal 100, Herb.parse("<div>" * 100, max_errors: nil).error_count
    end

    test "a zero count skips the recursive walk without losing errors" do
      clean = Herb.parse("<div>ok</div>")

      refute_predicate clean, :failed?
      assert_empty clean.errors
    end
  end
end
