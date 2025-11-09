# frozen_string_literal: true

require_relative "../test_helper"

module Extractor
  class ExtractRubySemicolonsTest < Minitest::Spec
    test "extract_ruby_single_erb_no_semicolon" do
      source = "<% if %>\n<% end %>"
      result = Herb.extract_ruby(source, with_semicolon: true)

      expected = "   if   \n   end   "
      assert_equal expected, result
    end

    test "extract_ruby_multiple_erb_same_line_with_semicolon" do
      source = "<% x = 1 %> <% y = 2 %>"
      result = Herb.extract_ruby(source, with_semicolon: true)

      assert_equal "   x = 1  ;    y = 2   ", result
    end

    test "extract_ruby_three_erb_same_line_with_semicolons" do
      source = "<% a = 1 %> <% b = 2 %> <% c = 3 %>"
      result = Herb.extract_ruby(source, with_semicolon: true)

      assert_equal "   a = 1  ;    b = 2  ;    c = 3   ", result
    end

    test "extract_ruby_different_lines_no_semicolons" do
      source = "<% x = 1 %>\n<% y = 2 %>"
      result = Herb.extract_ruby(source, with_semicolon: true)

      expected = "   x = 1   \n   y = 2   "
      assert_equal expected, result
    end

    test "extract_ruby_mixed_lines" do
      source = "<% a = 1 %> <% b = 2 %>\n<% c = 3 %>"
      result = Herb.extract_ruby(source, with_semicolon: true)

      expected = "   a = 1  ;    b = 2   \n   c = 3   "
      assert_equal expected, result
    end

    test "extract_ruby_output_tags_same_line" do
      source = "<%= x %> <%= y %>"
      result = Herb.extract_ruby(source, with_semicolon: true)

      assert_equal "    x  ;     y   ", result
    end

    test "extract_ruby_empty_erb_same_line" do
      source = "<%  %> <%  %>"
      result = Herb.extract_ruby(source, with_semicolon: true)

      assert_equal "     ;       ", result
    end

    test "extract_ruby_comments_skipped" do
      source = "<%# comment %> <% code %>"
      result = Herb.extract_ruby(source, with_semicolon: true)

      assert_equal "                  code   ", result
    end

    test "extract_ruby_issue_135_if_without_condition" do
      source = "<% if %>\n<% end %>"
      result = Herb.extract_ruby(source, with_semicolon: true)

      expected = "   if   \n   end   "
      assert_equal expected, result
    end

    test "extract_ruby_inline_comment_same_line" do
      source = "<% if true %><% # Comment here %><% end %>"
      result = Herb.extract_ruby(source, with_semicolon: true)

      assert_equal "   if true  ;                       end   ", result
    end

    test "extract_ruby_inline_comment_with_newline" do
      source = "<% if true %><% # Comment here %>\n<% end %>"
      result = Herb.extract_ruby(source, with_semicolon: true)

      expected = "   if true  ;                    \n   end   "
      assert_equal expected, result
    end

    test "extract_ruby_inline_comment_with_spaces" do
      source = "<%  # Comment %> <% code %>"
      result = Herb.extract_ruby(source, with_semicolon: true)

      assert_equal "                    code   ", result
    end

    test "extract_ruby_inline_comment_multiline" do
      source = "<% # Comment\nmore %> <% code %>"
      result = Herb.extract_ruby(source, with_semicolon: true)

      expected = "   # Comment\nmore  ;    code   "
      assert_equal expected, result
    end

    test "extract_ruby_inline_comment_between_code" do
      source = "<% if true %><% # Comment here %><%= hello %><% end %>"
      result = Herb.extract_ruby(source, with_semicolon: true)

      assert_equal "   if true  ;                        hello  ;   end   ", result
    end

    test "extract_ruby_inline_comment_complex" do
      source = "<% # Comment here %><% if true %><% # Comment here %><%= hello %><% end %>"
      result = Herb.extract_ruby(source, with_semicolon: true)

      assert_equal "                       if true  ;                        hello  ;   end   ", result
    end
  end
end
