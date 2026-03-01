#include "include/test.h"

#include "../../src/include/extract.h"
#include "../../src/include/util/hb_buffer.h"

#include <string.h>

TEST(extract_ruby_single_erb_with_semicolons)
  char* source = "<% if %>\n<% end %>";
  char* result = herb_extract_ruby_with_semicolons(source);

  char expected[] = "   if  ;\n   end  ;";
  ck_assert_str_eq(result, expected);

  free(result);
END

TEST(extract_ruby_multiple_erb_same_line_with_semicolon)
  char* source = "<% x = 1 %> <% y = 2 %>";
  char* result = herb_extract_ruby_with_semicolons(source);

  ck_assert_str_eq(result, "   x = 1  ;    y = 2  ;");

  free(result);
END

TEST(extract_ruby_three_erb_same_line_with_semicolons)
  char* source = "<% a = 1 %> <% b = 2 %> <% c = 3 %>";
  char* result = herb_extract_ruby_with_semicolons(source);

  ck_assert_str_eq(result, "   a = 1  ;    b = 2  ;    c = 3  ;");

  free(result);
END

TEST(extract_ruby_different_lines_with_semicolons)
  char* source = "<% x = 1 %>\n<% y = 2 %>";
  char* result = herb_extract_ruby_with_semicolons(source);

  char expected[] = "   x = 1  ;\n   y = 2  ;";
  ck_assert_str_eq(result, expected);

  free(result);
END

TEST(extract_ruby_mixed_lines)
  char* source = "<% a = 1 %> <% b = 2 %>\n<% c = 3 %>";
  char* result = herb_extract_ruby_with_semicolons(source);

  char expected[] = "   a = 1  ;    b = 2  ;\n   c = 3  ;";
  ck_assert_str_eq(result, expected);

  free(result);
END

TEST(extract_ruby_output_tags_same_line)
  char* source = "<%= x %> <%= y %>";
  char* result = herb_extract_ruby_with_semicolons(source);

  ck_assert_str_eq(result, "    x  ;     y  ;");

  free(result);
END

TEST(extract_ruby_empty_erb_same_line)
  char* source = "<%  %> <%  %>";
  char* result = herb_extract_ruby_with_semicolons(source);

  ck_assert_str_eq(result, "     ;      ;");

  free(result);
END

TEST(extract_ruby_comments_skipped)
  char* source = "<%# comment %> <% code %>";
  char* result = herb_extract_ruby_with_semicolons(source);

  ck_assert_str_eq(result, "                  code  ;");

  free(result);
END

TEST(extract_ruby_issue_135_if_without_condition)
  char* source = "<% if %>\n<% end %>";
  char* result = herb_extract_ruby_with_semicolons(source);

  char expected[] = "   if  ;\n   end  ;";
  ck_assert_str_eq(result, expected);

  free(result);
END

TEST(extract_ruby_inline_comment_same_line)
  char* source = "<% if true %><% # Comment here %><% end %>";
  char* result = herb_extract_ruby_with_semicolons(source);

  ck_assert_str_eq(result, "   if true  ;                       end  ;");

  free(result);
END

TEST(extract_ruby_inline_comment_with_newline)
  char* source = "<% if true %><% # Comment here %>\n<% end %>";
  char* result = herb_extract_ruby_with_semicolons(source);

  char expected[] = "   if true  ;                    \n   end  ;";
  ck_assert_str_eq(result, expected);

  free(result);
END

TEST(extract_ruby_inline_comment_with_spaces)
  char* source = "<%  # Comment %> <% code %>";
  char* result = herb_extract_ruby_with_semicolons(source);

  ck_assert_str_eq(result, "                    code  ;");

  free(result);
END

TEST(extract_ruby_inline_comment_multiline)
  char* source = "<% # Comment\nmore %> <% code %>";
  char* result = herb_extract_ruby_with_semicolons(source);

  char expected[] = "   # Comment\nmore  ;    code  ;";
  ck_assert_str_eq(result, expected);

  free(result);
END

TEST(extract_ruby_inline_comment_between_code)
  char* source = "<% if true %><% # Comment here %><%= hello %><% end %>";
  char* result = herb_extract_ruby_with_semicolons(source);

  ck_assert_str_eq(result, "   if true  ;                        hello  ;   end  ;");

  free(result);
END

TEST(extract_ruby_inline_comment_complex)
  char* source = "<% # Comment here %><% if true %><% # Comment here %><%= hello %><% end %>";
  char* result = herb_extract_ruby_with_semicolons(source);

  ck_assert_str_eq(result, "                       if true  ;                        hello  ;   end  ;");

  free(result);
END

TEST(extract_ruby_with_options_semicolons_false)
  char* source = "<% x = 1 %> <% y = 2 %>";

  hb_buffer_T output;
  hb_buffer_init(&output, strlen(source));

  herb_extract_ruby_options_T options = HERB_EXTRACT_RUBY_DEFAULT_OPTIONS;
  options.semicolons = false;

  herb_extract_ruby_to_buffer_with_options(source, &output, &options);

  ck_assert_str_eq(output.value, "   x = 1       y = 2   ");

  free(output.value);
END

TEST(extract_ruby_with_options_comments_true)
  char* source = "<%# comment %>\n<% code %>";

  hb_buffer_T output;
  hb_buffer_init(&output, strlen(source));

  herb_extract_ruby_options_T options = HERB_EXTRACT_RUBY_DEFAULT_OPTIONS;
  options.comments = true;

  herb_extract_ruby_to_buffer_with_options(source, &output, &options);

  ck_assert_str_eq(output.value, "  # comment   \n   code  ;");

  free(output.value);
END

TEST(extract_ruby_with_options_preserve_positions_false)
  char* source = "<% x = 1 %> <% y = 2 %>";

  hb_buffer_T output;
  hb_buffer_init(&output, strlen(source));

  herb_extract_ruby_options_T options = HERB_EXTRACT_RUBY_DEFAULT_OPTIONS;
  options.preserve_positions = false;

  herb_extract_ruby_to_buffer_with_options(source, &output, &options);

  ck_assert_str_eq(output.value, " x = 1 \n y = 2 ");

  free(output.value);
END

TEST(extract_ruby_with_options_preserve_positions_false_and_comments_true)
  char* source = "<%# comment %><%= something %>";

  hb_buffer_T output;
  hb_buffer_init(&output, strlen(source));

  herb_extract_ruby_options_T options = HERB_EXTRACT_RUBY_DEFAULT_OPTIONS;
  options.preserve_positions = false;
  options.comments = true;

  herb_extract_ruby_to_buffer_with_options(source, &output, &options);

  ck_assert_str_eq(output.value, "# comment \n something ");

  free(output.value);
END

TEST(extract_ruby_with_options_default)
  char* source = "<% x = 1 %> <% y = 2 %>";

  hb_buffer_T output;
  hb_buffer_init(&output, strlen(source));

  herb_extract_ruby_to_buffer_with_options(source, &output, &HERB_EXTRACT_RUBY_DEFAULT_OPTIONS);

  ck_assert_str_eq(output.value, "   x = 1  ;    y = 2  ;");

  free(output.value);
END

TCase *extract_tests(void) {
  TCase *extract = tcase_create("Extract");

  tcase_add_test(extract, extract_ruby_single_erb_with_semicolons);
  tcase_add_test(extract, extract_ruby_multiple_erb_same_line_with_semicolon);
  tcase_add_test(extract, extract_ruby_three_erb_same_line_with_semicolons);
  tcase_add_test(extract, extract_ruby_different_lines_with_semicolons);
  tcase_add_test(extract, extract_ruby_mixed_lines);
  tcase_add_test(extract, extract_ruby_output_tags_same_line);
  tcase_add_test(extract, extract_ruby_empty_erb_same_line);
  tcase_add_test(extract, extract_ruby_comments_skipped);
  tcase_add_test(extract, extract_ruby_issue_135_if_without_condition);
  tcase_add_test(extract, extract_ruby_inline_comment_same_line);
  tcase_add_test(extract, extract_ruby_inline_comment_with_newline);
  tcase_add_test(extract, extract_ruby_inline_comment_with_spaces);
  tcase_add_test(extract, extract_ruby_inline_comment_multiline);
  tcase_add_test(extract, extract_ruby_inline_comment_between_code);
  tcase_add_test(extract, extract_ruby_inline_comment_complex);
  tcase_add_test(extract, extract_ruby_with_options_semicolons_false);
  tcase_add_test(extract, extract_ruby_with_options_comments_true);
  tcase_add_test(extract, extract_ruby_with_options_preserve_positions_false);
  tcase_add_test(extract, extract_ruby_with_options_preserve_positions_false_and_comments_true);
  tcase_add_test(extract, extract_ruby_with_options_default);

  return extract;
}
