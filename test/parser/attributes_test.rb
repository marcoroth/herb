# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class AttributesTest < Minitest::Spec
    include SnapshotUtils

    test "attributes" do
      assert_parsed_snapshot(%(<div id="hello" class="container p-3"></div>))
    end

    test "duplicate attributes" do
      assert_parsed_snapshot(%(<div class="hello" class="container p-3"></div>))
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

    test "attribute value with space after equal sign" do
      assert_parsed_snapshot(%(<input value= "value" />))
    end

    test "attribute value with exclamation point" do
      assert_parsed_snapshot(%(<input value="Hello!" />))
    end
  end
end
