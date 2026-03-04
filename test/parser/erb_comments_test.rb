# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class ERBCommentsTest < Minitest::Spec
    include SnapshotUtils

    test "simple ERB comment should not crash WASM" do
      assert_parsed_snapshot("<%# ERB Comment %>")
    end

    test "ERB comment with newlines should not crash WASM" do
      assert_parsed_snapshot("<%# ERB\nComment %>")
    end

    test "ERB comment starting with newline should not crash WASM" do
      assert_parsed_snapshot("<%#\nERB Comment\n%>")
    end

    test "long single-line ERB comment should not crash WASM" do
      assert_parsed_snapshot("<%# #{"herb lsp " * 20} %>")
    end

    test "reproduces exact WASM failing pattern" do
      assert_parsed_snapshot("<%# herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp %>")
    end

    test "reproduces second WASM failing pattern 80 chars" do
      assert_parsed_snapshot("<%# This comment is exactly 80 characters long and should not crash %>")
    end

    test "reproduces second WASM failing pattern 100 chars" do
      assert_parsed_snapshot("<%# This is a very long ERB comment that exceeds 100 characters and should be handled gracefully %>")
    end

    test "multiline ERB comment like WASM failing case" do
      assert_parsed_snapshot("<%#\nhello\nthis is a\nmulti-line ERB\ncomment\n%>")
    end

    test "handles moderately long ERB comments (500 chars)" do
      assert_parsed_snapshot("<%# #{"a" * 500} %>")
    end

    test "handles long ERB comments (1000 chars)" do
      assert_parsed_snapshot("<%# #{"a" * 1000} %>")
    end

    test "handles very long ERB comments (5000 chars)" do
      assert_parsed_snapshot("<%# #{"a" * 5000} %>")
    end

    test "handles extremely long ERB comments (10000 chars)" do
      assert_parsed_snapshot("<%# #{"a" * 10_000} %>")
    end

    test "handles long multiline ERB comments" do
      lines = 100.times.map { |i| "Line #{i}: #{"x" * 50}" }
      content = "<%#\n#{lines.join("\n")}\n%>"
      assert_parsed_snapshot(content)
    end

    test "handles nested HTML with long ERB comments" do
      content = <<~ERB
        <div>
          <%# #{"This is a very long comment " * 100} %>
          <p>Content</p>
        </div>
      ERB
      assert_parsed_snapshot(content)
    end

    test "handles multiple long ERB comments" do
      content = <<~ERB
        <%# First long comment: #{"a" * 1000} %>
        <div>
          <%# Second long comment: #{"b" * 1000} %>
          <p>Content</p>
          <%# Third long comment: #{"c" * 1000} %>
        </div>
      ERB
      assert_parsed_snapshot(content)
    end

    test "handles ERB comments with special characters" do
      assert_parsed_snapshot("<%# #{'<>&\"' * 500} %>")
    end

    test "handles ERB comments with Unicode characters" do
      assert_parsed_snapshot("<%# #{"🚀✨💎" * 300} %>")
    end

    test "parses AST correctly for long ERB comments" do
      assert_parsed_snapshot("<%# #{"test" * 250} %>")
    end

    test "handles very large comment length (50000 chars)" do
      assert_parsed_snapshot("<%# #{"a" * 50_000} %>")
    end

    test "handles extremely large comment length (100_000 chars)" do
      assert_parsed_snapshot("<%# #{"a" * 100_000} %>")
    end

    test "handles deeply nested ERB comments without stack overflow" do
      assert_parsed_snapshot("<%# Start #{"nested " * 1000} End %>")
    end

    test "handles multiline ERB comments similar to WASM failing case" do
      long_comment = Array.new(1000) { |i| "Line #{i} with some content" }.join("\n")
      content = "<%#\n#{long_comment}\n%>"

      assert_parsed_snapshot(content)
    end
  end
end
