# frozen_string_literal: true

require_relative "test_helper"

class ColorsTest < Minitest::Spec
  test "colors are disabled in test environment" do
    assert defined?(Minitest), "Minitest should be defined in test environment"
    assert_equal false, Herb::Colors.enabled?, "Expected colors to be disabled when Minitest is loaded"
  end

  test "token inspect does not contain ANSI codes in tests" do
    start_position = Herb::Position.new(1, 0)
    end_position = Herb::Position.new(1, 5)
    location = Herb::Location.new(start_position, end_position)
    range = Herb::Range.new(0, 5)
    token = Herb::Token.new("<div>", range, location, "TOKEN_HTML_TAG_START")

    output = token.inspect

    refute_match(/\e\[/, output, "Token inspect should not contain ANSI codes in tests")

    assert_equal '#<Herb::Token type="TOKEN_HTML_TAG_START" value="<div>" range=[0, 5] start=(1:0) end=(1:5)>', output
  end

  test "AST node tree_inspect does not contain ANSI codes in tests" do
    result = Herb.parse("<div>hello</div>")
    output = result.value.tree_inspect

    refute_match(/\e\[/, output, "AST tree_inspect should not contain ANSI codes in tests")
  end

  test "NO_COLOR environment variable disables colors" do
    original = ENV["NO_COLOR"]

    begin
      ENV["NO_COLOR"] = "1"

      start_position = Herb::Position.new(1, 0)
      end_position = Herb::Position.new(1, 1)
      location = Herb::Location.new(start_position, end_position)
      range = Herb::Range.new(0, 1)
      token = Herb::Token.new("<", range, location, "TOKEN_HTML_TAG_START")

      output = token.inspect

      refute_match(/\e\[/, output, "Should not colorize when NO_COLOR=1")
    ensure
      if original
        ENV["NO_COLOR"] = original
      else
        ENV.delete("NO_COLOR")
      end
    end
  end

  test "colors are disabled inside IRB" do
    skip "IRB is already defined" if defined?(::IRB)

    ::IRB = Module.new

    start_position = Herb::Position.new(1, 0)
    end_position = Herb::Position.new(1, 1)
    location = Herb::Location.new(start_position, end_position)
    range = Herb::Range.new(0, 1)
    token = Herb::Token.new("<", range, location, "TOKEN_HTML_TAG_START")

    output = token.inspect

    refute_match(/\e\[/, output, "Should not colorize inside IRB")
    assert_equal false, Herb::Colors.enabled?, "Colors should be disabled when IRB is defined"
  ensure
    Object.send(:remove_const, :IRB) if defined?(::IRB) && ::IRB.is_a?(Module) && ::IRB.name.nil?
  end
end
