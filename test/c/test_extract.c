#include "include/test.h"

#include "../../src/include/extract.h"
#include "../../src/include/util/hb_allocator.h"
#include "../../src/include/util/hb_buffer.h"

#include <string.h>

TEST(extract_ruby_single_erb_with_semicolons)
  char* source = "<% if %>\n<% end %>";

  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  char* result = herb_extract_ruby_with_semicolons(source, &allocator);

  char expected[] = "   if  ;\n   end  ;";
  ck_assert_str_eq(result, expected);

  hb_allocator_destroy(&allocator);
  free(result);
END

TEST(extract_ruby_multiple_erb_same_line_with_semicolon)
  char* source = "<% x = 1 %> <% y = 2 %>";

  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  char* result = herb_extract_ruby_with_semicolons(source, &allocator);

  ck_assert_str_eq(result, "   x = 1  ;    y = 2  ;");

  hb_allocator_destroy(&allocator);
  free(result);
END

TEST(extract_ruby_three_erb_same_line_with_semicolons)
  char* source = "<% a = 1 %> <% b = 2 %> <% c = 3 %>";

  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  char* result = herb_extract_ruby_with_semicolons(source, &allocator);

  ck_assert_str_eq(result, "   a = 1  ;    b = 2  ;    c = 3  ;");

  hb_allocator_destroy(&allocator);
  free(result);
END

TEST(extract_ruby_different_lines_with_semicolons)
  char* source = "<% x = 1 %>\n<% y = 2 %>";

  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  char* result = herb_extract_ruby_with_semicolons(source, &allocator);

  char expected[] = "   x = 1  ;\n   y = 2  ;";
  ck_assert_str_eq(result, expected);

  hb_allocator_destroy(&allocator);
  free(result);
END

TEST(extract_ruby_mixed_lines)
  char* source = "<% a = 1 %> <% b = 2 %>\n<% c = 3 %>";

  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  char* result = herb_extract_ruby_with_semicolons(source, &allocator);

  char expected[] = "   a = 1  ;    b = 2  ;\n   c = 3  ;";
  ck_assert_str_eq(result, expected);

  hb_allocator_destroy(&allocator);
  free(result);
END

TEST(extract_ruby_output_tags_same_line)
  char* source = "<%= x %> <%= y %>";

  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  char* result = herb_extract_ruby_with_semicolons(source, &allocator);

  ck_assert_str_eq(result, "    x  ;     y  ;");

  hb_allocator_destroy(&allocator);
  free(result);
END

TEST(extract_ruby_empty_erb_same_line)
  char* source = "<%  %> <%  %>";

  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  char* result = herb_extract_ruby_with_semicolons(source, &allocator);

  ck_assert_str_eq(result, "     ;      ;");

  hb_allocator_destroy(&allocator);
  free(result);
END

TEST(extract_ruby_comments_skipped)
  char* source = "<%# comment %> <% code %>";

  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  char* result = herb_extract_ruby_with_semicolons(source, &allocator);

  ck_assert_str_eq(result, "                  code  ;");

  hb_allocator_destroy(&allocator);
  free(result);
END

TEST(extract_ruby_issue_135_if_without_condition)
  char* source = "<% if %>\n<% end %>";

  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  char* result = herb_extract_ruby_with_semicolons(source, &allocator);

  char expected[] = "   if  ;\n   end  ;";
  ck_assert_str_eq(result, expected);

  hb_allocator_destroy(&allocator);
  free(result);
END

TEST(extract_ruby_inline_comment_same_line)
  char* source = "<% if true %><% # Comment here %><% end %>";

  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  char* result = herb_extract_ruby_with_semicolons(source, &allocator);

  ck_assert_str_eq(result, "   if true  ;                       end  ;");

  hb_allocator_destroy(&allocator);
  free(result);
END

TEST(extract_ruby_inline_comment_with_newline)
  char* source = "<% if true %><% # Comment here %>\n<% end %>";

  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  char* result = herb_extract_ruby_with_semicolons(source, &allocator);

  char expected[] = "   if true  ;                    \n   end  ;";
  ck_assert_str_eq(result, expected);

  hb_allocator_destroy(&allocator);
  free(result);
END

TEST(extract_ruby_inline_comment_with_spaces)
  char* source = "<%  # Comment %> <% code %>";

  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  char* result = herb_extract_ruby_with_semicolons(source, &allocator);

  ck_assert_str_eq(result, "                    code  ;");

  hb_allocator_destroy(&allocator);
  free(result);
END

TEST(extract_ruby_inline_comment_multiline)
  char* source = "<% # Comment\nmore %> <% code %>";

  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  char* result = herb_extract_ruby_with_semicolons(source, &allocator);

  char expected[] = "   # Comment\nmore  ;    code  ;";
  ck_assert_str_eq(result, expected);

  hb_allocator_destroy(&allocator);
  free(result);
END

TEST(extract_ruby_inline_comment_between_code)
  char* source = "<% if true %><% # Comment here %><%= hello %><% end %>";

  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  char* result = herb_extract_ruby_with_semicolons(source, &allocator);

  ck_assert_str_eq(result, "   if true  ;                        hello  ;   end  ;");

  hb_allocator_destroy(&allocator);
  free(result);
END

TEST(extract_ruby_inline_comment_complex)
  char* source = "<% # Comment here %><% if true %><% # Comment here %><%= hello %><% end %>";

  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  char* result = herb_extract_ruby_with_semicolons(source, &allocator);

  ck_assert_str_eq(result, "                       if true  ;                        hello  ;   end  ;");

  hb_allocator_destroy(&allocator);
  free(result);
END

TEST(extract_ruby_with_options_semicolons_false)
  char* source = "<% x = 1 %> <% y = 2 %>";

  hb_buffer_T output;
  hb_buffer_init(&output, strlen(source));

  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_extract_ruby_options_T options = HERB_EXTRACT_RUBY_DEFAULT_OPTIONS;
  options.semicolons = false;

  herb_extract_ruby_to_buffer_with_options(source, &output, &options, &allocator);

  ck_assert_str_eq(output.value, "   x = 1       y = 2   ");

  hb_allocator_destroy(&allocator);
  free(output.value);
END

TEST(extract_ruby_with_options_comments_true)
  char* source = "<%# comment %>\n<% code %>";

  hb_buffer_T output;
  hb_buffer_init(&output, strlen(source));

  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_extract_ruby_options_T options = HERB_EXTRACT_RUBY_DEFAULT_OPTIONS;
  options.comments = true;

  herb_extract_ruby_to_buffer_with_options(source, &output, &options, &allocator);

  ck_assert_str_eq(output.value, "  # comment   \n   code  ;");

  hb_allocator_destroy(&allocator);
  free(output.value);
END

TEST(extract_ruby_with_options_preserve_positions_false)
  char* source = "<% x = 1 %> <% y = 2 %>";

  hb_buffer_T output;
  hb_buffer_init(&output, strlen(source));

  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_extract_ruby_options_T options = HERB_EXTRACT_RUBY_DEFAULT_OPTIONS;
  options.preserve_positions = false;

  herb_extract_ruby_to_buffer_with_options(source, &output, &options, &allocator);

  ck_assert_str_eq(output.value, " x = 1 \n y = 2 ");

  hb_allocator_destroy(&allocator);
  free(output.value);
END

TEST(extract_ruby_with_options_preserve_positions_false_and_comments_true)
  char* source = "<%# comment %><%= something %>";

  hb_buffer_T output;
  hb_buffer_init(&output, strlen(source));

  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_extract_ruby_options_T options = HERB_EXTRACT_RUBY_DEFAULT_OPTIONS;
  options.preserve_positions = false;
  options.comments = true;

  herb_extract_ruby_to_buffer_with_options(source, &output, &options, &allocator);

  ck_assert_str_eq(output.value, "# comment \n something ");

  hb_allocator_destroy(&allocator);
  free(output.value);
END

TEST(extract_ruby_with_options_default)
  char* source = "<% x = 1 %> <% y = 2 %>";

  hb_buffer_T output;
  hb_buffer_init(&output, strlen(source));

  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_extract_ruby_to_buffer_with_options(source, &output, &HERB_EXTRACT_RUBY_DEFAULT_OPTIONS, &allocator);

  ck_assert_str_eq(output.value, "   x = 1  ;    y = 2  ;");

  hb_allocator_destroy(&allocator);
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
