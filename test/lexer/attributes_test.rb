# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class AttributesTest < Minitest::Spec
    include SnapshotUtils

    test "attribute value double quotes" do
      assert_lexed_snapshot(%(<img value="hello world" />))
    end

    test "attribute value single quotes" do
      assert_lexed_snapshot(%(<img value='hello world' />))
    end

    test "attribute value empty double quotes with whitespace" do
      assert_lexed_snapshot(%(<img value="" />))
    end

    test "attribute value empty double quotes without whitespace" do
      assert_lexed_snapshot(%(<img value=""/>))
    end

    test "attribute value empty single quotes with whitespace" do
      assert_lexed_snapshot("<img value='' />")
    end

    test "attribute value empty single quotes without whitespace" do
      assert_lexed_snapshot("<img value=''/>")
    end

    test "attribute value single quotes with slash gt" do
      assert_lexed_snapshot("<img value='/>'/>")
    end

    test "attribute value double quotes with slash gt" do
      # `>` is not valid as an attribute value, it should be &lt; which is why we parse it as TOKEN_HTML_TAG_END
      assert_lexed_snapshot(%(<img value="/>"/>))
    end

    test "attribute value single quotes with > value" do
      # `>` is not valid as an attribute value, it should be &lt; which is why we parse it as TOKEN_HTML_TAG_END
      assert_lexed_snapshot(%(<img value='>'/>))
    end

    test "attribute value double quotes with slash" do
      assert_lexed_snapshot(%(<img value="/"/>))
    end

    test "Alpine.js @click attribute" do
      assert_lexed_snapshot(%(<button @click="handleClick">Click me</button>))
    end

    test "Alpine.js @submit attribute" do
      assert_lexed_snapshot(%(<form @submit="handleSubmit">Submit</form>))
    end

    test "Alpine.js :class attribute" do
      assert_lexed_snapshot(%(<div :class="{ active: isActive }">Content</div>))
    end

    test "Alpine.js :value attribute" do
      assert_lexed_snapshot(%(<input :value="inputValue" />))
    end

    test "Multiple Alpine.js attributes" do
      assert_lexed_snapshot(%(<div @click="onClick" :class="classes" x-data="{ open: false }"></div>))
    end

    test "Alpine.js @ without identifier" do
      assert_lexed_snapshot(%(<div @>Content</div>))
    end

    test "Alpine.js : without identifier" do
      assert_lexed_snapshot(%(<div :>Content</div>))
    end

    test "attribute value double quotes with > value" do
      assert_lexed_snapshot(%(<img value=">"/>))
    end

    test "attribute value single quotes with slash value" do
      assert_lexed_snapshot(%(<img value='/'/>))
    end

    test "attribute value double quotes with single quote value" do
      assert_lexed_snapshot(%(<img value="''"/>))
    end

    test "attribute value single quotes with double quote value" do
      assert_lexed_snapshot(%(<img value='""'/>))
    end

    test "attribute value empty quotes followed by another attribute" do
      assert_lexed_snapshot(%(<img value="" required />))
    end

    test "attribute value with a period" do
      assert_lexed_snapshot(%(<div value="hello. world."></div>))
    end

    test "attribute value with a slash" do
      assert_lexed_snapshot(%(<div value="hello/ world/"></div>))
    end

    test "attribute value with an URL" do
      assert_lexed_snapshot(%(<a href="https://example.com"></div>))
    end
  end
end
