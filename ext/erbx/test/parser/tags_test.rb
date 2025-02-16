# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class TagsTest < Minitest::Spec
    test "empty" do
      result = ERBX.parse("")

      assert_equal "AST_NOOP_NODE", result.root_node.type
      assert_equal 0, result.root_node.child_count
    end

    xtest "basic tag" do
      result = ERBX.parse("<html></html>")

      assert_equal "AST_NOOP_NODE", result.root_node.type
      assert_equal 0, result.root_node.child_count
    end
  end
end
