# frozen_string_literal: true

require_relative "test_helper"

class CompilerTest < Minitest::Test
  def test_compiler
    assert_equal "test", ERBX::Compiler.new.compile("<html></html>")
  end
end
