#include "../../src/include/css_parser.h"
#include "include/test.h"

#include <check.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

TEST(test_css_parse_valid)
  const char* css = "body { color: red; padding: 10px; }";
  struct css_parse_result_T* result = herb_css_parse(css);

  ck_assert_ptr_nonnull(result);
  ck_assert(result->success);
  ck_assert_ptr_null(result->error_message);
  ck_assert_ptr_nonnull(result->rules);
  ck_assert_uint_gt(result->rule_count, 0);

  ck_assert_uint_eq(result->rule_count, 1);

  struct CSSRule* rule = result->rules[0];
  ck_assert_ptr_nonnull(rule->selector);

  ck_assert_uint_gt(rule->declaration_count, 0);

  herb_css_free_result(result);
END

TEST(test_css_parse_invalid)
  const char* css = "body { @@@invalid }"; // Invalid CSS
  struct css_parse_result_T* result = herb_css_parse(css);

  ck_assert_ptr_nonnull(result);
  ck_assert(!result->success);
  ck_assert_ptr_nonnull(result->error_message);
  ck_assert_ptr_null(result->rules);

  herb_css_free_result(result);
END

TEST(test_css_parse_declarations)
  const char* css = "body {\n  color: red;\n  padding: 10px;\n}";
  struct css_parse_result_T* result = herb_css_parse(css);

  ck_assert_ptr_nonnull(result);
  ck_assert(result->success);
  ck_assert_ptr_nonnull(result->rules);
  ck_assert_uint_eq(result->rule_count, 1);

  struct CSSRule* rule = result->rules[0];
  ck_assert_uint_eq(rule->declaration_count, 2);

  herb_css_free_result(result);
END

TEST(test_css_validate_valid)
  const char* css = "body { color: red; }";
  bool valid = herb_css_validate(css);

  ck_assert(valid);
END

TEST(test_css_validate_invalid)
  const char* css = "body { @@@invalid }";
  bool valid = herb_css_validate(css);

  ck_assert(!valid);
END

TEST(test_css_parse_multiple_rules)
  const char* css = "body { color: red; } p { margin: 5px; }";
  struct css_parse_result_T* result = herb_css_parse(css);

  ck_assert_ptr_nonnull(result);
  ck_assert(result->success);
  ck_assert_uint_eq(result->rule_count, 2);

  herb_css_free_result(result);
END

TEST(test_css_parse_empty)
  const char* css = "";
  struct css_parse_result_T* result = herb_css_parse(css);

  ck_assert_ptr_nonnull(result);
  ck_assert(result->success);
  ck_assert_uint_eq(result->rule_count, 0);

  herb_css_free_result(result);
END

TCase* css_tests(void) {
  TCase *css = tcase_create("CSS Parser (Lightning CSS)");

  tcase_add_test(css, test_css_parse_valid);
  tcase_add_test(css, test_css_parse_invalid);
  tcase_add_test(css, test_css_parse_declarations);
  tcase_add_test(css, test_css_parse_multiple_rules);
  tcase_add_test(css, test_css_parse_empty);
  tcase_add_test(css, test_css_validate_valid);
  tcase_add_test(css, test_css_validate_invalid);

  return css;
}
