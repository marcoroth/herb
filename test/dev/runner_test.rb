# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/dev/runner"

module Dev
  class RunnerTest < Minitest::Spec
    test "text_changed is patchable" do
      diff_result = Herb.diff("<div>Hello</div>", "<div>World</div>")

      assert Herb::Dev::Runner.can_patch?(diff_result.operations)
      assert_equal 1, diff_result.operation_count
      assert_equal :text_changed, diff_result.operations[0].type
    end

    test "attribute_value_changed is patchable" do
      diff_result = Herb.diff('<div class="old">Content</div>', '<div class="new">Content</div>')

      assert Herb::Dev::Runner.can_patch?(diff_result.operations)
      assert_equal 1, diff_result.operation_count
      assert_equal :attribute_value_changed, diff_result.operations[0].type
    end

    test "attribute_added is patchable" do
      diff_result = Herb.diff("<div>Content</div>", '<div id="main">Content</div>')

      assert Herb::Dev::Runner.can_patch?(diff_result.operations)
      assert_equal 1, diff_result.operation_count
      assert_equal :attribute_added, diff_result.operations[0].type
    end

    test "attribute_removed is patchable" do
      diff_result = Herb.diff('<div id="main">Content</div>', "<div>Content</div>")

      assert Herb::Dev::Runner.can_patch?(diff_result.operations)
      assert_equal 1, diff_result.operation_count
      assert_equal :attribute_removed, diff_result.operations[0].type
    end

    test "node_inserted triggers reload" do
      diff_result = Herb.diff("<div></div>", "<div><span>New</span></div>")

      refute Herb::Dev::Runner.can_patch?(diff_result.operations)
    end

    test "node_removed triggers reload" do
      diff_result = Herb.diff("<div><span>Old</span></div>", "<div></div>")

      refute Herb::Dev::Runner.can_patch?(diff_result.operations)
    end

    test "erb_content_changed triggers reload" do
      diff_result = Herb.diff("<%= foo %>", "<%= bar %>")

      refute Herb::Dev::Runner.can_patch?(diff_result.operations)
    end

    test "inserting ERB node triggers reload" do
      diff_result = Herb.diff("<div>Hello</div>", "<div><%= name %></div>")

      refute Herb::Dev::Runner.can_patch?(diff_result.operations)
    end

    test "identical templates produce no operations" do
      diff_result = Herb.diff("<div>Hello</div>", "<div>Hello</div>")

      assert diff_result.identical?
      assert_equal 0, diff_result.operation_count
    end

    test "multiple patchable operations are all patchable" do
      diff_result = Herb.diff('<div class="old">Hello</div>', '<div class="new">World</div>')

      assert Herb::Dev::Runner.can_patch?(diff_result.operations)
      assert_equal 2, diff_result.operation_count
    end

    test "mixed patchable and non-patchable triggers reload" do
      diff_result = Herb.diff('<div class="old">Hello</div>', '<div class="new">Hello</div><span>New</span>')

      refute Herb::Dev::Runner.can_patch?(diff_result.operations)
    end
  end
end
