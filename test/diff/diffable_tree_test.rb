# frozen_string_literal: true

require_relative "../test_helper"

module Diff
  class DiffableTreeTest < Minitest::Spec
    test "parse returns a DiffableTree" do
      tree = Herb::DiffableTree.parse("<div>Hello</div>")

      assert_kind_of Herb::DiffableTree, tree
    end

    test "retains the source" do
      tree = Herb::DiffableTree.parse("<div>Hello</div>")

      assert_equal "<div>Hello</div>", tree.source
    end

    test "cannot be constructed with new" do
      assert_raises(NoMethodError) { Herb::DiffableTree.new }
    end

    test "parse accepts parser options" do
      tree = Herb::DiffableTree.parse("<div>\n  <span>a</span>\n</div>", track_whitespace: true)

      assert_kind_of Herb::DiffableTree, tree
    end

    test "parse_result converts the retained tree" do
      tree = Herb::DiffableTree.parse("<div>Hello</div>")
      result = tree.parse_result

      assert_kind_of Herb::ParseResult, result
      assert_empty result.errors
      assert_equal 1, result.value.children.size
    end

    test "parse_result is memoized" do
      tree = Herb::DiffableTree.parse("<div>Hello</div>")

      assert_same tree.parse_result, tree.parse_result
    end

    test "quacks like a ParseResult" do
      tree = Herb::DiffableTree.parse("<div>Hello</div>")

      assert_equal 1, tree.value.children.size
      assert_empty tree.errors
      assert_empty tree.warnings
      assert_predicate tree, :success?
      refute_predicate tree, :failed?
    end

    test "diff between two trees" do
      old_tree = Herb::DiffableTree.parse("<div>Hello</div>")
      new_tree = Herb::DiffableTree.parse("<div>World</div>")

      result = Herb.diff(old_tree, new_tree)

      assert_kind_of Herb::DiffResult, result
      refute result.identical?
      assert_equal 1, result.operation_count
      assert_equal :text_changed, result.operations[0].type
    end

    test "diff between identical trees" do
      old_tree = Herb::DiffableTree.parse("<div>Hello</div>")
      new_tree = Herb::DiffableTree.parse("<div>Hello</div>")

      assert Herb.diff(old_tree, new_tree).identical?
    end

    test "diff accepts a tree and a string" do
      tree = Herb::DiffableTree.parse("<div>Hello</div>")

      result = Herb.diff(tree, "<div>World</div>")

      assert_equal 1, result.operation_count
      assert_equal :text_changed, result.operations[0].type
    end

    test "diff accepts a string and a tree" do
      tree = Herb::DiffableTree.parse("<div>World</div>")

      result = Herb.diff("<div>Hello</div>", tree)

      assert_equal 1, result.operation_count
      assert_equal :text_changed, result.operations[0].type
    end

    test "tree diffing matches string diffing" do
      old_source = '<div class="old"><span>Hello</span></div>'
      new_source = '<div class="new"><span>World</span><b>!</b></div>'

      string_result = Herb.diff(old_source, new_source)
      tree_result = Herb.diff(Herb::DiffableTree.parse(old_source), Herb::DiffableTree.parse(new_source))

      assert_equal string_result.identical?, tree_result.identical?
      assert_equal(string_result.operations.map { |operation| [operation.type, operation.path] },
                   tree_result.operations.map { |operation| [operation.type, operation.path] })
    end

    test "DiffableTree#diff is equivalent to Herb.diff" do
      old_tree = Herb::DiffableTree.parse("<div>Hello</div>")
      new_tree = Herb::DiffableTree.parse("<div>World</div>")

      assert_equal Herb.diff(old_tree, new_tree).operations.map(&:type),
                   old_tree.diff(new_tree).operations.map(&:type)
    end

    test "DiffableTree#diff accepts a string" do
      tree = Herb::DiffableTree.parse("<div>Hello</div>")

      assert_equal 1, tree.diff("<div>World</div>").operation_count
    end

    test "a tree can be diffed against itself" do
      tree = Herb::DiffableTree.parse("<div>Hello</div>")

      assert tree.diff(tree).identical?
    end

    test "a tree can be diffed repeatedly" do
      old_tree = Herb::DiffableTree.parse("<div>Hello</div>")

      3.times do |i|
        result = old_tree.diff("<div>World #{i}</div>")

        assert_equal 1, result.operation_count
      end
    end

    test "diff result outlives the trees it came from" do
      result = Herb.diff(
        Herb::DiffableTree.parse('<div class="a">Hello</div>'),
        Herb::DiffableTree.parse('<div class="b">Hello</div>')
      )

      GC.start

      assert_equal :attribute_value_changed, result.operations[0].type
      refute_nil result.operations[0].old_node
    end

    test "trees survive garbage collection of other trees" do
      trees = 50.times.map { |i| Herb::DiffableTree.parse("<p>#{i}</p>") }
      old_tree = trees[0]
      new_tree = trees[49]
      trees = nil # rubocop:disable Lint/UselessAssignment

      GC.start

      assert_equal 1, Herb.diff(old_tree, new_tree).operation_count
    end

    test "diff raises for arguments that are neither strings nor trees" do
      tree = Herb::DiffableTree.parse("<div></div>")

      assert_raises(TypeError) { Herb.diff(tree, 123) }
      assert_raises(TypeError) { Herb.diff(:symbol, tree) }
    end

    test "diff treats nil as an empty template" do
      tree = Herb::DiffableTree.parse("<div></div>")

      result = Herb.diff(nil, tree)

      assert_equal 1, result.operation_count
      assert_equal :node_inserted, result.operations[0].type
    end
  end
end
