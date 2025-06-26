#include "include/test.h"
#include "../../src/include/analyze_tag_helpers.h"

#include <string.h>
#include <stdlib.h>

// Test is_tag_helper
TEST(test_is_tag_helper)
  ck_assert(is_tag_helper("tag.div"));
  ck_assert(is_tag_helper("tag.div \"Hello!\""));
  ck_assert(is_tag_helper("tag.custom_element"));
  ck_assert(is_tag_helper("content_tag :span"));
  ck_assert(is_tag_helper("content_tag :span \"World!\""));
  ck_assert(is_tag_helper("content_tag \"section\""));
  ck_assert(is_tag_helper("content_tag \"section\", \"Hello!\""));
  ck_assert(!is_tag_helper("not_a_tag"));
END

// Test extract_tag_name_from_helper
TEST(test_extract_tag_name_from_helper)
  char* name = extract_tag_name_from_helper("tag.div");
  ck_assert_ptr_nonnull(name);
  ck_assert_str_eq(name, "div");
  free(name);

  name = extract_tag_name_from_helper("content_tag :span");
  ck_assert_ptr_nonnull(name);
  ck_assert_str_eq(name, "span");
  free(name);

  name = extract_tag_name_from_helper("content_tag \"section\"");
  ck_assert_ptr_nonnull(name);
  ck_assert_str_eq(name, "section");
  free(name);

  name = extract_tag_name_from_helper("tag.custom_element");
  ck_assert_ptr_nonnull(name);
  ck_assert_str_eq(name, "custom_element");
  free(name);

  name = extract_tag_name_from_helper("content_tag :span \"World!\"");
  ck_assert_ptr_nonnull(name);
  ck_assert_str_eq(name, "span");
  free(name);

  name = extract_tag_name_from_helper("content_tag \"section\", \"Hello!\"");
  ck_assert_ptr_nonnull(name);
  ck_assert_str_eq(name, "section");
  free(name);
END

// Test extract_tag_helper_content
TEST(test_extract_tag_helper_content)
  char* content = extract_tag_helper_content("tag.div \"Hello!\"");
  ck_assert_ptr_nonnull(content);
  ck_assert_str_eq(content, "Hello!");
  free(content);

  content = extract_tag_helper_content("content_tag :span, \"World!\"");
  ck_assert_ptr_nonnull(content);
  ck_assert_str_eq(content, "World!");
  free(content);

  content = extract_tag_helper_content("content_tag \"section\", \"Hello!\"");
  ck_assert_ptr_nonnull(content);
  ck_assert_str_eq(content, "Hello!");
  free(content);
END

TCase *analyze_tag_helpers_tests(void) {
  TCase *tag_helpers = tcase_create("AnalyzeTagHelpers");

  tcase_add_test(tag_helpers, test_is_tag_helper);
  tcase_add_test(tag_helpers, test_extract_tag_name_from_helper);
  tcase_add_test(tag_helpers, test_extract_tag_helper_content);

  return tag_helpers;
}
