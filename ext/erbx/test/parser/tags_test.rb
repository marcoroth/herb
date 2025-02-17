# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class TagsTest < Minitest::Spec
    include SnapshotUtils

    def assert_parsed_snapshot(source)
      parsed = ERBX.parse(source)
      expected = parsed.root_node.inspect

      assert_snapshot_matches(expected, source)
    end

    test "empty" do
      assert_parsed_snapshot("")
    end

    test "basic tag" do
      assert_parsed_snapshot(%(<html></html>))
    end

    test "mismatched closing tag" do
      assert_parsed_snapshot(%(<html></div>))
    end

    test "nested tags" do
      assert_parsed_snapshot(%(<div><h1>Hello<span>World</span></h1></div>))
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
