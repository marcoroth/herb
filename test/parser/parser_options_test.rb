# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class ParserOptionsTest < Minitest::Spec
    test "html is on by default" do
      options = Herb::ParserOptions.new

      assert_equal true, options.html
      assert_equal true, options.to_h[:html]
      assert_equal true, Herb.parse("<b>bold</b>").options.html
    end

    test "html false reaches the parse result" do
      options = Herb::ParserOptions.new(html: false)

      assert_equal false, options.html
      assert_equal false, options.to_h[:html]
      assert_includes options.inspect, "html=false"

      result = Herb.parse("a <b", html: false)

      assert_equal false, result.options.html
      assert_instance_of Herb::AST::LiteralNode, result.value.children.first
    end

    test "to_h round-trips through Herb.parse" do
      options = Herb::ParserOptions.new(html: false, strict: false)
      result = Herb.parse("a <b", **options.to_h)

      assert_equal false, result.options.html
      assert_equal false, result.options.strict
    end
  end
end
