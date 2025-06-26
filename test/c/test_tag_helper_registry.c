#include "include/test.h"
#include "../../src/include/tag_helper_handler.h"
#include <string.h>
#include <stdlib.h>

TEST(test_tag_helper_info_init)
  tag_helper_info_T* info = tag_helper_info_init();

  ck_assert_ptr_nonnull(info);
  ck_assert_ptr_null(info->tag_name);
  ck_assert_ptr_null(info->call_node);
  ck_assert_ptr_null(info->attributes);
  ck_assert_ptr_null(info->content);
  ck_assert(!info->has_block);

  tag_helper_info_free(&info);
  ck_assert_ptr_null(info);
END

TEST(test_tag_helper_info_free_null)
  tag_helper_info_T* info = NULL;
  tag_helper_info_free(&info);
  ck_assert_ptr_null(info);
END

TEST(test_tag_helper_info_free_with_data)
  tag_helper_info_T* info = tag_helper_info_init();
  info->tag_name = calloc(4, sizeof(char));
  strcpy(info->tag_name, "div");
  info->content = calloc(6, sizeof(char));
  strcpy(info->content, "hello");

  tag_helper_info_free(&info);
  ck_assert_ptr_null(info);
END

TEST(test_get_tag_helper_handlers)
  tag_helper_handler_T* handlers = get_tag_helper_handlers();
  ck_assert_ptr_nonnull(handlers);
END

TEST(test_get_tag_helper_handlers_count)
  size_t count = get_tag_helper_handlers_count();
  ck_assert_int_ge(count, 2);
END

TEST(test_handlers_have_required_functions)
  tag_helper_handler_T* handlers = get_tag_helper_handlers();
  size_t count = get_tag_helper_handlers_count();

  for (size_t i = 0; i < count; i++) {
    ck_assert_ptr_nonnull(handlers[i].name);
    ck_assert_ptr_nonnull(handlers[i].detect);
    ck_assert_ptr_nonnull(handlers[i].extract_tag_name);
    ck_assert_ptr_nonnull(handlers[i].extract_content);
    ck_assert_ptr_nonnull(handlers[i].supports_block);
  }
END

TEST(test_content_tag_handler_exists)
  tag_helper_handler_T* handlers = get_tag_helper_handlers();
  size_t count = get_tag_helper_handlers_count();

  bool found_content_tag = false;
  for (size_t i = 0; i < count; i++) {
    if (strcmp(handlers[i].name, "content_tag") == 0) {
      found_content_tag = true;
      ck_assert_str_eq(handlers[i].name, "content_tag");
      break;
    }
  }

  ck_assert(found_content_tag);
END

TEST(test_tag_dot_handler_exists)
  tag_helper_handler_T* handlers = get_tag_helper_handlers();
  size_t count = get_tag_helper_handlers_count();

  bool found_tag_dot = false;
  for (size_t i = 0; i < count; i++) {
    if (strcmp(handlers[i].name, "tag") == 0) {
      found_tag_dot = true;
      ck_assert_str_eq(handlers[i].name, "tag");
      break;
    }
  }

  ck_assert(found_tag_dot);
END

TEST(test_handlers_have_unique_names)
  tag_helper_handler_T* handlers = get_tag_helper_handlers();
  size_t count = get_tag_helper_handlers_count();

  for (size_t i = 0; i < count; i++) {
    for (size_t j = i + 1; j < count; j++) {
      ck_assert_str_ne(handlers[i].name, handlers[j].name);
    }
  }
END

TEST(test_all_handlers_support_blocks)
  tag_helper_handler_T* handlers = get_tag_helper_handlers();
  size_t count = get_tag_helper_handlers_count();

  for (size_t i = 0; i < count; i++) {
    bool supports_block = handlers[i].supports_block();
    ck_assert(supports_block);
  }
END

TCase *tag_helper_registry_tests(void) {
  TCase *registry = tcase_create("TagHelperRegistry");

  tcase_add_test(registry, test_tag_helper_info_init);
  tcase_add_test(registry, test_tag_helper_info_free_null);
  tcase_add_test(registry, test_tag_helper_info_free_with_data);
  tcase_add_test(registry, test_get_tag_helper_handlers);
  tcase_add_test(registry, test_get_tag_helper_handlers_count);
  tcase_add_test(registry, test_handlers_have_required_functions);
  tcase_add_test(registry, test_content_tag_handler_exists);
  tcase_add_test(registry, test_tag_dot_handler_exists);
  tcase_add_test(registry, test_handlers_have_unique_names);
  tcase_add_test(registry, test_all_handlers_support_blocks);

  return registry;
}
