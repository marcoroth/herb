# frozen_string_literal: true

require_relative "../test_helper"

module FFIBackend
  class RubySyntaxErrorsTest < Minitest::Spec
    before do
      skip "only with the FFI backend" unless defined?(Herb::FFI::Backend)
    end

    test "valid Ruby has no errors" do
      assert_equal [], Herb::FFI.ruby_syntax_errors("x = 1\nputs x")
    end

    test "reports each error with its Prism type, message and line" do
      assert_equal [[:invalid_block_exit, "Invalid next", 2]], Herb::FFI.ruby_syntax_errors("1\nnext")
    end

    test "reports invalid yield, which Herb::Engine ignores" do
      assert_equal [[:invalid_yield, "Invalid yield", 1]], Herb::FFI.ruby_syntax_errors("yield")
    end

    test "reports parse errors" do
      types = Herb::FFI.ruby_syntax_errors("def f(").map(&:first)

      assert_equal [:def_params_term_paren, :unexpected_token_close_context, :def_term], types
    end
  end
end
