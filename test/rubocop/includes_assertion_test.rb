# frozen_string_literal: true

require_relative "../test_helper"

require "rubocop"
require_relative "../../rubocop/cop/herb/includes_assertion"

class IncludesAssertionCopTest < Minitest::Spec
  test "registers an offense for assert_includes" do
    offenses = investigate(<<~RUBY)
      assert_includes output, "hello"
    RUBY

    assert_equal 1, offenses.size
    assert_equal "Do not use `assert_includes`. Use one of the `assert_*_snapshot` helpers instead.", offenses.first.message
    assert_equal 1, offenses.first.line
    assert_equal "assert_includes", offenses.first.location.source
  end

  test "registers an offense for refute_includes" do
    offenses = investigate(<<~RUBY)
      refute_includes output, "hello"
    RUBY

    assert_equal 1, offenses.size
    assert_equal "Do not use `refute_includes`. Use one of the `assert_*_snapshot` helpers instead.", offenses.first.message
  end

  test "registers an offense for every occurrence" do
    offenses = investigate(<<~RUBY)
      assert_includes output, "hello"
      refute_includes output, "goodbye"
    RUBY

    assert_equal 2, offenses.size
  end

  test "does not register an offense for other assertions" do
    offenses = investigate(<<~RUBY)
      assert_equal "hello", output
      assert_match(/hello/, output)
      assert_compiled_snapshot(source)
    RUBY

    assert_empty offenses
  end

  test "does not register an offense for a call with an explicit receiver" do
    offenses = investigate(<<~RUBY)
      helper.assert_includes output, "hello"
    RUBY

    assert_empty offenses
  end

  private

  def investigate(source)
    config = RuboCop::Config.new({ "Herb/IncludesAssertion" => { "Enabled" => true } })
    cop = RuboCop::Cop::Herb::IncludesAssertion.new(config)
    processed_source = RuboCop::ProcessedSource.new(source, 3.2)
    commissioner = RuboCop::Cop::Commissioner.new([cop], [], raise_error: true)

    commissioner.investigate(processed_source).offenses
  end
end
