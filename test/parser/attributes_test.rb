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

    test "attribute value with space before equal sign" do
      assert_parsed_snapshot(%(<input value ="value" />))
    end

    test "attribute value with space before and after equal sign" do
      assert_parsed_snapshot(%(<div class    =    "hello">Content</div>))
    end

    test "attribute value with newline before equal sign" do
      assert_parsed_snapshot(%(<input value
="value" />))
    end

    test "attribute value with newline after equal sign" do
      assert_parsed_snapshot(%(<input value=
"value" />))
    end

    test "attribute value with newline before and after equal sign" do
      assert_parsed_snapshot(%(<input value
=
"value" />))
    end

    test "attribute value with mixed whitespace and newlines around equal sign" do
      assert_parsed_snapshot(%(<div class
  =
  "hello">Content</div>))
    end

    test "attribute value with exclamation point" do
      assert_parsed_snapshot(%(<input value="Hello!" />))
    end

    test "style attribute with url" do
      assert_parsed_snapshot(%(<div style="background-image: url('./images/image.png')"></div>))
    end

    test "double quotes inside single quotes" do
      assert_parsed_snapshot(%(<div data-json='{"key": "value"}'></div>))
    end

    test "multiple nested quotes" do
      assert_parsed_snapshot(%(<div title="She said 'Hello' and 'Goodbye'"></div>))
    end

    test "empty quoted attribute values" do
      assert_parsed_snapshot(%(<input value="" placeholder='' />))
    end

    test "mixed quote types in multiple attributes" do
      assert_parsed_snapshot(%(<input value="double quoted" placeholder='single quoted' />))
    end

    test "erb output with quotes" do
      assert_parsed_snapshot(%(<div title="<%= "quoted string" %>"></div>))
    end

    test "attributes with dots in name" do
      assert_parsed_snapshot(%(<div x-transition.duration.500ms x-show="visible" x-cloak></div>))
    end

    test "complex attribute with dots and values" do
      assert_parsed_snapshot(%(<div x-transition.duration.500ms="fast" data-component.option="value"></div>))
    end

    test "attributes starting with @ symbol" do
      assert_parsed_snapshot(%(<div @click="handleClick" @keyup.enter="submit"></div>))
    end

    test "@ attributes with various patterns" do
      assert_parsed_snapshot(%(<div @submit.prevent @change.debounce.100ms="update" @mouseover></div>))
    end

    test "standalone @ symbol in div tag" do
      assert_parsed_snapshot(%(<div @></div>))
    end

    test "standalone @ symbol followed by whitesapce in div tag" do
      assert_parsed_snapshot(%(<div @ ></div>))
    end

    test "standalone @ symbol followed by whitesapce and identifier in div tag" do
      assert_parsed_snapshot(%(<div @ click></div>))
    end

    test "standalone @ symbol in div tag followed by attribute" do
      assert_parsed_snapshot(%(<div @ data-attribute="test"></div>))
    end

    test "atttribute with @ prefix and now value" do
      assert_parsed_snapshot(%(<div @click></div>))
    end
  end
end
