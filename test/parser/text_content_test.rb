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

    test "exclamation point" do
      assert_parsed_snapshot("Hello World!")
    end

    test "exclamation point in element" do
      assert_parsed_snapshot("<h1>Hello World!</h1>")
    end
  end
end
