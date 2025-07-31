# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class TextContentTest < Minitest::Spec
    include SnapshotUtils

    test "text content" do
      assert_parsed_snapshot("Hello World")
    end

    test "text content inside tag" do
      assert_parsed_snapshot("<h1>Hello World</h1>")
    end

    test "text content with tag after" do
      assert_parsed_snapshot("Hello<span>World</span>")
    end

    test "text content with tag before" do
      assert_parsed_snapshot("<span>Hello</span>World")
    end

    test "text content with tag around" do
      assert_parsed_snapshot("Hello<span></span>World")
    end

    test "text content that exceeds initial buffer_T size (ca. 4K)" do
      initial_buffer_capacity = 1024 # bytes
      content = cyclic_string((((initial_buffer_capacity * 2) + 1) * 2) + 1)
      result = assert_parsed_snapshot(%(<div>#{content}</div>))

      assert_equal content, result.value.children.first.body.first.content
    end

    test "text content that exceeds initial buffer_T size (ca. 8K)" do
      initial_buffer_capacity = 1024 # bytes
      content = cyclic_string((((((initial_buffer_capacity * 2) + 1) * 2) + 1) * 2) + 1)
      result = assert_parsed_snapshot(%(<div>#{content}</div>))

      assert_equal content, result.value.children.first.body.first.content
    end

    test "exclamation as only content" do
      assert_parsed_snapshot("<b>!</b>")
    end

    test "comma as only content" do
      assert_parsed_snapshot("<b>,</b>")
    end

    test "dollar sign as only content" do
      assert_parsed_snapshot("<b>$</b>")
    end

    test "dash as only content" do
      assert_parsed_snapshot("<b>-</b>")
    end

    test "period as only content" do
      assert_parsed_snapshot("<b>.</b>")
    end

    test "percent as only content" do
      assert_parsed_snapshot("<b>%</b>")
    end

    test "slash as only content" do
      assert_parsed_snapshot("<b>/</b>")
    end

    test "underscore as only content" do
      assert_parsed_snapshot("<b>_</b>")
    end

    test "colon as only content" do
      assert_parsed_snapshot("<b>:</b>")
    end

    test "semicolon as only content" do
      assert_parsed_snapshot("<b>;</b>")
    end

    test "ampersand as only content" do
      assert_parsed_snapshot("<b>&</b>")
    end

    test "equals as only content" do
      assert_parsed_snapshot("<b>=</b>")
    end

    test "a-umlaut as only content" do
      assert_parsed_snapshot("<b>ä</b>")
    end

    test "o-umlaut as only content" do
      assert_parsed_snapshot("<b>ö</b>")
    end

    test "u-umlaut as only content" do
      assert_parsed_snapshot("<b>ü</b>")
    end

    test "emoji as only content" do
      assert_parsed_snapshot("<b>🌿</b>")
    end

    test "non-breaking space (U+00A0) as only content" do
      assert_parsed_snapshot("<b> </b>")
    end

    test "non-breaking space mixed with ERB - issue 310" do
      assert_parsed_snapshot("<p><%= hello %> !</p>")
    end

    test "multiple non-breaking spaces in text" do
      assert_parsed_snapshot("<p>Hello   World</p>")
    end

    test "non-breaking space in attribute value" do
      assert_parsed_snapshot('<div title="Hello World">Content</div>')
    end
  end
end
