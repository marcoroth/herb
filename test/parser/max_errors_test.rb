# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class MaxErrorsTest < Minitest::Spec
    test "default max_errors caps errors at 25" do
      source = "<div>" * 1000
      result = Herb.parse(source)

      missing_tag_errors = result.errors.select { |e| e.is_a?(Herb::Errors::MissingClosingTagError) }
      assert_equal 25, missing_tag_errors.size
    end

    test "custom max_errors caps errors at specified limit" do
      source = "<div>" * 1000
      result = Herb.parse(source, max_errors: 5)

      missing_tag_errors = result.errors.select { |e| e.is_a?(Herb::Errors::MissingClosingTagError) }
      assert_equal 5, missing_tag_errors.size
    end

    test "max_errors nil means unlimited" do
      source = "<div>" * 100
      result = Herb.parse(source, max_errors: nil)

      missing_tag_errors = result.errors.select { |e| e.is_a?(Herb::Errors::MissingClosingTagError) }
      assert_equal 100, missing_tag_errors.size
    end

    test "max_errors applies to missing opening tag errors" do
      source = "</div>" * 1000
      result = Herb.parse(source, max_errors: 10)

      missing_tag_errors = result.errors.select { |e| e.is_a?(Herb::Errors::MissingOpeningTagError) }
      assert_equal 10, missing_tag_errors.size
    end

    test "normal templates are not affected by max_errors" do
      source = "<div><span>hello</span></div>"
      result = Herb.parse(source)

      assert result.errors.empty?
    end
  end
end
