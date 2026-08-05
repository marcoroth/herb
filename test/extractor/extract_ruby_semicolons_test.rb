# frozen_string_literal: true

require_relative "../test_helper"

module Extractor
  class ExtractRubySemicolonsTest < Minitest::Spec
    test "extract_ruby_single_erb_with_semicolon" do
      source = "<% if %>\n<% end %>"
      result = Herb.extract_ruby(source, semicolons: true)

      expected = "   if  ;\n   end  ;"
      assert_equal expected, result
    end

    test "extract_ruby_multiple_erb_same_line_with_semicolon" do
      source = "<% x = 1 %> <% y = 2 %>"
      result = Herb.extract_ruby(source, semicolons: true)

      assert_equal "   x = 1  ;    y = 2  ;", result
    end

    test "extract_ruby_three_erb_same_line_with_semicolons" do
      source = "<% a = 1 %> <% b = 2 %> <% c = 3 %>"
      result = Herb.extract_ruby(source, semicolons: true)

      assert_equal "   a = 1  ;    b = 2  ;    c = 3  ;", result
    end

    test "extract_ruby_different_lines_with_semicolons" do
      source = "<% x = 1 %>\n<% y = 2 %>"
      result = Herb.extract_ruby(source, semicolons: true)

      expected = "   x = 1  ;\n   y = 2  ;"
      assert_equal expected, result
    end

    test "extract_ruby_mixed_lines" do
      source = "<% a = 1 %> <% b = 2 %>\n<% c = 3 %>"
      result = Herb.extract_ruby(source, semicolons: true)

      expected = "   a = 1  ;    b = 2  ;\n   c = 3  ;"
      assert_equal expected, result
    end

    test "extract_ruby_output_tags_same_line" do
      source = "<%= x %> <%= y %>"
      result = Herb.extract_ruby(source, semicolons: true)

      assert_equal "    x  ;     y  ;", result
    end

    test "extract_ruby_empty_erb_same_line" do
      source = "<%  %> <%  %>"
      result = Herb.extract_ruby(source, semicolons: true)

      assert_equal "     ;      ;", result
    end

    test "extract_ruby_comments_skipped" do
      source = "<%# comment %> <% code %>"
      result = Herb.extract_ruby(source, semicolons: true)

      assert_equal "                  code  ;", result
    end

    test "extract_ruby_issue_135_if_without_condition" do
      source = "<% if %>\n<% end %>"
      result = Herb.extract_ruby(source, semicolons: true)

      expected = "   if  ;\n   end  ;"
      assert_equal expected, result
    end

    test "extract_ruby_inline_comment_same_line" do
      source = "<% if true %><% # Comment here %><% end %>"
      result = Herb.extract_ruby(source, semicolons: true)

      assert_equal "   if true  ;                       end  ;", result
    end

    test "extract_ruby_inline_comment_with_newline" do
      source = "<% if true %><% # Comment here %>\n<% end %>"
      result = Herb.extract_ruby(source, semicolons: true)

      expected = "   if true  ;                    \n   end  ;"
      assert_equal expected, result
    end

    test "extract_ruby_inline_comment_with_spaces" do
      source = "<%  # Comment %> <% code %>"
      result = Herb.extract_ruby(source, semicolons: true)

      assert_equal "                    code  ;", result
    end

    test "extract_ruby_inline_comment_multiline" do
      source = "<% # Comment\nmore %> <% code %>"
      result = Herb.extract_ruby(source, semicolons: true)

      expected = "   # Comment\nmore  ;    code  ;"
      assert_equal expected, result
    end

    test "extract_ruby_inline_comment_between_code" do
      source = "<% if true %><% # Comment here %><%= hello %><% end %>"
      result = Herb.extract_ruby(source, semicolons: true)

      assert_equal "   if true  ;                        hello  ;   end  ;", result
    end

    test "extract_ruby_inline_comment_complex" do
      source = "<% # Comment here %><% if true %><% # Comment here %><%= hello %><% end %>"
      result = Herb.extract_ruby(source, semicolons: true)

      assert_equal "                       if true  ;                        hello  ;   end  ;", result
    end

    test "extract_ruby_without_semicolons" do
      source = "<% x = 1 %> <% y = 2 %>"
      result = Herb.extract_ruby(source, semicolons: false)

      assert_equal "   x = 1       y = 2   ", result
    end

    test "extract_ruby_without_semicolons_multiline" do
      source = "<% if %>\n<% end %>"
      result = Herb.extract_ruby(source, semicolons: false)

      expected = "   if   \n   end   "
      assert_equal expected, result
    end

    test "extract_ruby_with_comments_included" do
      source = "<%# comment %>"
      result = Herb.extract_ruby(source, comments: true)

      assert_equal "  # comment   ", result
    end

    test "extract_ruby_with_comments_and_code_same_line" do
      source = "<%# comment %> <% code %>"
      result = Herb.extract_ruby(source, comments: true)

      assert_equal "  # comment       code  ;", result
    end

    test "extract_ruby_with_comments_on_separate_lines" do
      source = "<%# comment %>\n<% code %>"
      result = Herb.extract_ruby(source, comments: true)

      assert_equal "  # comment   \n   code  ;", result
    end

    test "extract_ruby_without_semicolons_with_comments" do
      source = "<%# comment %> <% code %>"
      result = Herb.extract_ruby(source, semicolons: false, comments: true)

      assert_equal "  # comment       code   ", result
    end

    test "extract_ruby_without_preserve_positions_single_tag" do
      source = "<% code %>"
      result = Herb.extract_ruby(source, preserve_positions: false)

      assert_equal " code ", result
    end

    test "extract_ruby_without_preserve_positions_multiple_tags_same_line" do
      source = "<% x = 1 %> <% y = 2 %>"
      result = Herb.extract_ruby(source, preserve_positions: false)

      assert_equal " x = 1 \n y = 2 ", result
    end

    test "extract_ruby_without_preserve_positions_with_html" do
      source = "<div><% code %></div>"
      result = Herb.extract_ruby(source, preserve_positions: false)

      assert_equal " code ", result
    end

    test "extract_ruby_without_preserve_positions_multiline" do
      source = "<% if true %>\n  <% x = 1 %>\n<% end %>"
      result = Herb.extract_ruby(source, preserve_positions: false)

      assert_equal " if true \n x = 1 \n end ", result
    end

    test "extract_ruby_without_preserve_positions_with_comments" do
      source = "<%# comment %><%= something_else %>"
      result = Herb.extract_ruby(source, preserve_positions: false, comments: true)

      assert_equal "# comment \n something_else ", result
    end

    test "extract_ruby_without_preserve_positions_comments_dont_affect_code" do
      source = "<%# this is a comment %><% code %>"
      result = Herb.extract_ruby(source, preserve_positions: false, comments: true)

      assert_equal "# this is a comment \n code ", result
    end

    test "extract_ruby_without_preserve_positions_skips_comments_by_default" do
      source = "<%# comment %><% code %>"
      result = Herb.extract_ruby(source, preserve_positions: false)

      assert_equal " code ", result
    end
  end
end
