# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class TagsTest < Minitest::Spec
    include SnapshotUtils

    before :all do
      if ENV["UPDATE_SNAPSHOTS"]
        # FileUtils.rm_rf(snapshot_file.dirname)
      end
    end

    def assert_parsed_snapshot(source)
      parsed = ERBX.parse(source)
      expected = parsed.root_node.inspect

      save_failures_to_snapshot(expected) unless ENV["UPDATE_SNAPSHOTS"].nil?

      assert_snapshot_matches(expected)
    end

    test "empty" do
      assert_parsed_snapshot("")

      result = ERBX.parse("")

      assert_equal "AST_HTML_DOCUMENT_NODE", result.root_node.type
      assert_equal 0, result.root_node.child_count
    end

    test "basic tag" do
      html = "<html></html>"

      assert_parsed_snapshot(html)

      result = ERBX.parse(html)

      assert_equal "AST_HTML_DOCUMENT_NODE", result.root_node.type
      assert_equal 1, result.root_node.child_count

      assert_equal "AST_HTML_ELEMENT_NODE", result.root_node.children.first.type
      assert_equal 2, result.root_node.children.first.child_count

      assert_equal "AST_HTML_OPEN_TAG_NODE", result.root_node.children.first.children.first.type
      # assert_equal "html", result.root_node.children.first.children.first.name

      assert_equal "AST_HTML_CLOSE_TAG_NODE", result.root_node.children.first.children.last.type
      # assert_equal "html", result.root_node.children.first.children.last.name
    end

    test "mismatched closing tag" do
      html = "<html></div>"

      assert_parsed_snapshot(html)

      result = ERBX.parse(html)

      assert_equal "AST_HTML_DOCUMENT_NODE", result.root_node.type
      assert_equal 1, result.root_node.child_count

      assert_equal "AST_HTML_ELEMENT_NODE", result.root_node.children.first.type
      assert_equal 3, result.root_node.children.first.child_count

      assert_equal(["AST_HTML_OPEN_TAG_NODE", "AST_HTML_CLOSE_TAG_NODE", "AST_UNEXCPECTED_TOKEN_NODE"], result.root_node.children.first.children.items.map(&:type))
    end

    test "attributes" do
      html = %(<div id="hello" class="container p-3"></div>)

      assert_parsed_snapshot(html)

      result = ERBX.parse(html)

      assert_equal "AST_HTML_DOCUMENT_NODE", result.root_node.type
      assert_equal 1, result.root_node.child_count

      assert_equal "AST_HTML_ELEMENT_NODE", result.root_node.children.first.type
      assert_equal 2, result.root_node.children.first.child_count

      assert_equal "AST_HTML_OPEN_TAG_NODE", result.root_node.children.first.children.first.type
      # assert_equal "html", result.root_node.children.first.children.first.name

      assert_equal "AST_HTML_CLOSE_TAG_NODE", result.root_node.children.first.children[1].type
      # assert_equal "html", result.root_node.children.first.children.last.name

      assert_equal "AST_HTML_CLOSE_TAG_NODE", result.root_node.children.first.children.last.type
      # assert_equal "Unexpected...", result.root_node.children.first.children.last.name
    end

    test "attributes" do
      assert_parsed_snapshot(%(<div id="hello" class="container p-3"></div>))
    end

    test "basic void tag" do
      assert_parsed_snapshot("<img />")
    end

    test "basic void tag without whitespace" do
      assert_parsed_snapshot("<img/>")
    end

    test "namespaced tag" do
      assert_parsed_snapshot("<ns:table></ns:table>")
    end

    test "colon inside html tag" do
      assert_parsed_snapshot(%(<div : class=""></div>))
    end

    test "text content" do
      assert_parsed_snapshot("<h1>Hello World</h1>")
    end

    test "attribute with no quotes value and whitespace and self-closing tag" do
      assert_parsed_snapshot("<img value=hello />")
    end

    test "attribute with no quotes value, no whitespace and self-closing tag" do
      assert_parsed_snapshot("<img value=hello/>")
    end

    test "attribute with no quotes value, no whitespace, and non self-closing tag" do
      assert_parsed_snapshot("<div value=hello>")
    end
  end
end
