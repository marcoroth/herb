#include "include/test.h"
#include "../../src/include/analyze_tag_helpers.h"
#include "../../src/include/tag_helper_handler.h"
#include <string.h>
#include <stdlib.h>

TEST(test_is_tag_helper_detects_content_tag)
  ck_assert(is_tag_helper("content_tag :div"));
  ck_assert(is_tag_helper("content_tag \"span\""));
  ck_assert(is_tag_helper("content_tag :div, \"Hello\""));
  ck_assert(is_tag_helper("content_tag \"section\", \"World\""));
END

TEST(test_is_tag_helper_detects_tag_dot)
  ck_assert(is_tag_helper("tag.div"));
  ck_assert(is_tag_helper("tag.span"));
  ck_assert(is_tag_helper("tag.custom_element"));
  ck_assert(is_tag_helper("tag.div \"Hello\""));
END

TEST(test_is_tag_helper_rejects_non_helpers)
  ck_assert(!is_tag_helper("other_method"));
  ck_assert(!is_tag_helper("div"));
  ck_assert(!is_tag_helper("user.name"));
  ck_assert(!is_tag_helper("object.tag"));
  ck_assert(!is_tag_helper("tags.first"));
END

TEST(test_extract_tag_name_content_tag)
  char* name = extract_tag_name_from_helper("content_tag :div");
  ck_assert_ptr_nonnull(name);
  ck_assert_str_eq(name, "div");
  free(name);

  name = extract_tag_name_from_helper("content_tag \"span\"");
  ck_assert_ptr_nonnull(name);
  ck_assert_str_eq(name, "span");
  free(name);
END

TEST(test_extract_tag_name_tag_dot)
  char* name = extract_tag_name_from_helper("tag.div");
  ck_assert_ptr_nonnull(name);
  ck_assert_str_eq(name, "div");
  free(name);

  name = extract_tag_name_from_helper("tag.custom_element");
  ck_assert_ptr_nonnull(name);
  ck_assert_str_eq(name, "custom_element");
  free(name);
END

TEST(test_extract_tag_name_invalid)
  char* name = extract_tag_name_from_helper("other_method");
  ck_assert_ptr_null(name);

  name = extract_tag_name_from_helper("user.name");
  ck_assert_ptr_null(name);
END

TEST(test_extract_content_content_tag)
  char* content = extract_tag_helper_content("content_tag :div, \"Hello World\"");
  ck_assert_ptr_nonnull(content);
  ck_assert_str_eq(content, "Hello World");
  free(content);
END

TEST(test_extract_content_tag_dot)
  char* content = extract_tag_helper_content("tag.div \"Hello World\"");
  ck_assert_ptr_nonnull(content);
  ck_assert_str_eq(content, "Hello World");
  free(content);
END

TEST(test_extract_content_no_content)
  char* content = extract_tag_helper_content("content_tag :div");
  ck_assert_ptr_null(content);

  content = extract_tag_helper_content("tag.div");
  ck_assert_ptr_null(content);
END

TEST(test_has_attributes_with_keyword_args)
  ck_assert(has_tag_helper_attributes("content_tag :div, class: \"container\""));
  ck_assert(has_tag_helper_attributes("tag.div class: \"btn\", id: \"main\""));
END

TEST(test_has_attributes_without_keyword_args)
  ck_assert(!has_tag_helper_attributes("content_tag :div"));
  ck_assert(!has_tag_helper_attributes("tag.div"));
  ck_assert(!has_tag_helper_attributes("content_tag :div, \"Hello\""));
  ck_assert(!has_tag_helper_attributes("tag.div \"Hello\""));
END

TEST(test_modular_system_consistency)
  tag_helper_handler_T* handlers = get_tag_helper_handlers();
  size_t count = get_tag_helper_handlers_count();

  ck_assert_int_ge(count, 2);

  const char* test_cases[] = {
    "content_tag :div",
    "content_tag \"span\"",
    "tag.div",
    "tag.span",
    "tag.custom_element"
  };

  for (size_t i = 0; i < sizeof(test_cases) / sizeof(test_cases[0]); i++) {
    bool detected_by_main = is_tag_helper(test_cases[i]);
    char* extracted_name = extract_tag_name_from_helper(test_cases[i]);

    ck_assert(detected_by_main);
    ck_assert_ptr_nonnull(extracted_name);

    free(extracted_name);
  }
END

TEST(test_all_handlers_integrated)
  const char* content_tag_test = "content_tag :div, class: \"test\"";
  const char* tag_dot_test = "tag.span id: \"example\"";

  ck_assert(is_tag_helper(content_tag_test));
  ck_assert(is_tag_helper(tag_dot_test));
  ck_assert(has_tag_helper_attributes(content_tag_test));
  ck_assert(has_tag_helper_attributes(tag_dot_test));

  char* name1 = extract_tag_name_from_helper(content_tag_test);
  char* name2 = extract_tag_name_from_helper(tag_dot_test);

  ck_assert_str_eq(name1, "div");
  ck_assert_str_eq(name2, "span");

  free(name1);
  free(name2);
END

TCase *modular_tag_helpers_tests(void) {
  TCase *modular = tcase_create("ModularTagHelpers");

  tcase_add_test(modular, test_is_tag_helper_detects_content_tag);
  tcase_add_test(modular, test_is_tag_helper_detects_tag_dot);
  tcase_add_test(modular, test_is_tag_helper_rejects_non_helpers);
  tcase_add_test(modular, test_extract_tag_name_content_tag);
  tcase_add_test(modular, test_extract_tag_name_tag_dot);
  tcase_add_test(modular, test_extract_tag_name_invalid);
  tcase_add_test(modular, test_extract_content_content_tag);
  tcase_add_test(modular, test_extract_content_tag_dot);
  tcase_add_test(modular, test_extract_content_no_content);
  tcase_add_test(modular, test_has_attributes_with_keyword_args);
  tcase_add_test(modular, test_has_attributes_without_keyword_args);
  tcase_add_test(modular, test_modular_system_consistency);
  tcase_add_test(modular, test_all_handlers_integrated);

  return modular;
}
