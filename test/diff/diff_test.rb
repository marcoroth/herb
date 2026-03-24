# frozen_string_literal: true

require_relative "../test_helper"

module Diff
  class DiffTest < Minitest::Spec
    test "returns a DiffResult" do
      result = Herb.diff("<div>Hello</div>", "<div>Hello</div>")

      assert_kind_of Herb::DiffResult, result
    end

    test "operations returns DiffOperation instances" do
      result = Herb.diff("<div>Hello</div>", "<div>World</div>")

      assert_kind_of Herb::DiffOperation, result.operations[0]
    end

    test "identical documents" do
      result = Herb.diff("<div>Hello</div>", "<div>Hello</div>")

      assert result.identical?
      refute result.changed?
      assert_equal 0, result.operation_count
    end

    test "text changed" do
      result = Herb.diff("<div>Hello</div>", "<div>World</div>")

      refute result.identical?
      assert result.changed?
      assert_equal 1, result.operation_count
      assert_equal :text_changed, result.operations[0].type
    end

    test "attribute value changed" do
      result = Herb.diff('<div class="old">Hi</div>', '<div class="new">Hi</div>')

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :attribute_value_changed, result.operations[0].type
    end

    test "attribute added" do
      result = Herb.diff("<div>Hi</div>", '<div class="new">Hi</div>')

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :attribute_added, result.operations[0].type
    end

    test "attribute removed" do
      result = Herb.diff('<div class="old">Hi</div>', "<div>Hi</div>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :attribute_removed, result.operations[0].type
    end

    test "node inserted" do
      result = Herb.diff("<div></div>", "<div><span>New</span></div>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :node_inserted, result.operations[0].type
    end

    test "node removed" do
      result = Herb.diff("<div><span>Old</span></div>", "<div></div>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :node_removed, result.operations[0].type
    end

    test "erb content changed" do
      result = Herb.diff("<%= foo %>", "<%= bar %>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :erb_content_changed, result.operations[0].type
    end

    test "node moved with distinguishing attributes" do
      result = Herb.diff(
        '<ul><li class="a">A</li><li class="b">B</li></ul>',
        '<ul><li class="b">B</li><li class="a">A</li></ul>'
      )

      refute result.identical?

      types = result.operations.map(&:type)

      assert_includes types, :node_moved
    end

    test "plain reorder without attributes reports text changes not moves" do
      result = Herb.diff(
        "<ul><li>A</li><li>B</li></ul>",
        "<ul><li>B</li><li>A</li></ul>"
      )

      refute result.identical?

      types = result.operations.map(&:type)

      refute_includes types, :node_moved
      assert_includes types, :text_changed
    end

    test "move with attribute value change" do
      result = Herb.diff(
        '<div id="x" class="old">A</div><div id="y">B</div>',
        '<div id="y">B</div><div id="x" class="new">A</div>'
      )

      refute result.identical?

      types = result.operations.map(&:type)

      assert_includes types, :node_moved
      assert_includes types, :attribute_value_changed
    end

    test "move with content change" do
      result = Herb.diff(
        '<div id="a">Old</div><div id="b">B</div>',
        '<div id="b">B</div><div id="a">New</div>'
      )

      refute result.identical?

      types = result.operations.map(&:type)

      assert_includes types, :node_moved
      assert_includes types, :text_changed
    end

    test "multiple changes with unchanged subtree" do
      result = Herb.diff(
        '<div class="old"><span>Hello</span><p>Keep</p></div>',
        '<div class="new"><span>World</span><p>Keep</p></div>'
      )

      refute result.identical?
      assert_equal 2, result.operation_count

      types = result.operations.map(&:type)

      assert_includes types, :attribute_value_changed
      assert_includes types, :text_changed
    end

    test "operations have path" do
      result = Herb.diff("<div>Hello</div>", "<div>World</div>")

      operation = result.operations[0]

      assert_kind_of Array, operation.path
      refute_empty operation.path
    end

    test "operations have old and new nodes" do
      result = Herb.diff("<div>Hello</div>", "<div>World</div>")

      operation = result.operations[0]

      assert_kind_of Herb::AST::HTMLTextNode, operation.old_node
      assert_kind_of Herb::AST::HTMLTextNode, operation.new_node
    end

    test "inserted operation has nil old node" do
      result = Herb.diff("<div></div>", "<div><span>New</span></div>")

      operation = result.operations[0]

      assert_nil operation.old_node
      refute_nil operation.new_node
    end

    test "removed operation has nil new node" do
      result = Herb.diff("<div><span>Old</span></div>", "<div></div>")

      operation = result.operations[0]

      refute_nil operation.old_node
      assert_nil operation.new_node
    end

    test "complex erb diff" do
      old_source = <<~ERB
        <div class="container">
          <% if current_user %>
            <p>Hello, <%= current_user.name %></p>
          <% end %>
        </div>
      ERB

      new_source = <<~ERB
        <div class="wrapper">
          <% if current_user %>
            <p>Hello, <%= current_user.email %></p>
          <% end %>
        </div>
      ERB

      result = Herb.diff(old_source, new_source)

      refute result.identical?

      types = result.operations.map(&:type)

      assert_includes types, :attribute_value_changed
      assert_includes types, :erb_content_changed
    end

    test "wrap with ERB conditional" do
      result = Herb.diff("<div>Content</div>", "<% if condition? %><div>Content</div><% end %>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :node_wrapped, result.operations[0].type
    end

    test "unwrap from ERB conditional" do
      result = Herb.diff("<% if condition? %><div>Content</div><% end %>", "<div>Content</div>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :node_unwrapped, result.operations[0].type
    end

    test "wrap with HTML element" do
      result = Herb.diff("<div>Hello</div>", "<h1><div>Hello</div></h1>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :node_wrapped, result.operations[0].type
    end

    test "unwrap from HTML element" do
      result = Herb.diff("<section><p>Text</p></section>", "<p>Text</p>")

      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :node_unwrapped, result.operations[0].type
    end

    test "wrap with content change is not detected as wrap" do
      result = Herb.diff("<div>Old</div>", "<% if x %><div>New</div><% end %>")

      refute result.identical?

      types = result.operations.map(&:type)

      refute_includes types, :node_wrapped
    end

    test "wrapped operation has old and new nodes" do
      result = Herb.diff("<div>Content</div>", "<% if condition? %><div>Content</div><% end %>")

      operation = result.operations[0]

      assert_kind_of Herb::AST::HTMLElementNode, operation.old_node
      assert_kind_of Herb::AST::ERBIfNode, operation.new_node
    end

    test "to_hash serialization" do
      result = Herb.diff("<div>Hello</div>", "<div>World</div>")

      hash = result.to_hash

      assert_kind_of Hash, hash
      assert_equal false, hash[:identical]
      assert_kind_of Array, hash[:operations]
      assert_equal :text_changed, hash[:operations][0][:type]
    end

    test "inspect output" do
      identical_result = Herb.diff("<div>Same</div>", "<div>Same</div>")
      assert_match(/identical/, identical_result.inspect)

      changed_result = Herb.diff("<div>Hello</div>", "<div>World</div>")
      assert_match(/1 operation/, changed_result.inspect)
    end
  end
end
