# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class TagsTest < Minitest::Spec
    include SnapshotUtils

    test "basic tag" do
      assert_lexed_snapshot("<html></html>")
    end

    test "basic void tag" do
      assert_lexed_snapshot("<img />")
    end

    test "basic void tag without whitespace" do
      assert_lexed_snapshot("<img/>")
    end

    test "namespaced tag" do
      assert_lexed_snapshot("<ns:table></ns:table>")
    end

    test "colon inside html " do
      assert_lexed_snapshot(%(<div : class=""></div>))
    end

    test "text content" do
      assert_lexed_snapshot("<h1>Hello World</h1>")
    end

    test "attribute with no quotes value and whitespace and self-closing tag" do
      assert_lexed_snapshot("<img value=hello />")
    end

    test "attribute with no quotes value, no whitespace and self-closing tag" do
      assert_lexed_snapshot("<img value=hello/>")
    end

    test "attribute with no quotes value, no whitespace, and non self-closing tag" do
      assert_lexed_snapshot("<div value=hello>")
    end

    test "link tag" do
      assert_lexed_snapshot(%(<link href="https://mywebsite.com/style.css" rel="stylesheet">))
    end
  end
end
