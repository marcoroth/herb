# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class TagsTest < Minitest::Spec
    include SnapshotUtils

    test "empty tag" do
      assert_parsed_snapshot("<span></span>")
    end

    test "empty tag with whitespace" do
      assert_parsed_snapshot("<span> </span>")
    end

    test "empty tag with newline" do
      assert_parsed_snapshot("<span>\n</span>")
    end

    test "br tag" do
      assert_parsed_snapshot("<br>")
    end

    test "br self-closing tag" do
      assert_parsed_snapshot("<br/>")
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

    test "link tag" do
      assert_parsed_snapshot(%(<link href="https://mywebsite.com/style.css" rel="stylesheet">))
    end
  end
end
