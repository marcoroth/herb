#include "include/test.h"
#include "../../src/include/tag_helper_handler.h"
#include <prism.h>
#include <string.h>
#include <stdlib.h>

extern tag_helper_handler_T content_tag_handler;

static pm_call_node_t* create_test_call_node(const char* code, pm_parser_t* parser) {
  pm_node_t* root = pm_parse(parser);
  if (!root || root->type != PM_PROGRAM_NODE) return NULL;

  pm_program_node_t* program = (pm_program_node_t*) root;
  if (!program->statements->body.size || program->statements->body.nodes[0]->type != PM_CALL_NODE) return NULL;

  return (pm_call_node_t*) program->statements->body.nodes[0];
}

TEST(test_detect_content_tag_basic)
  pm_parser_t parser;
  const char* code = "content_tag :div";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  bool result = content_tag_handler.detect(call_node, &parser);
  ck_assert(result);

  pm_parser_free(&parser);
END

TEST(test_detect_content_tag_with_string)
  pm_parser_t parser;
  const char* code = "content_tag \"span\"";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  bool result = content_tag_handler.detect(call_node, &parser);
  ck_assert(result);

  pm_parser_free(&parser);
END

TEST(test_detect_content_tag_with_content)
  pm_parser_t parser;
  const char* code = "content_tag :div, \"Hello World\"";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  bool result = content_tag_handler.detect(call_node, &parser);
  ck_assert(result);

  pm_parser_free(&parser);
END

TEST(test_detect_content_tag_false_positive)
  pm_parser_t parser;
  const char* code = "other_method :div";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  bool result = content_tag_handler.detect(call_node, &parser);
  ck_assert(!result);

  pm_parser_free(&parser);
END

TEST(test_extract_content_tag_name_symbol)
  pm_parser_t parser;
  const char* code = "content_tag :div";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  char* tag_name = content_tag_handler.extract_tag_name(call_node, &parser);
  ck_assert_ptr_nonnull(tag_name);
  ck_assert_str_eq(tag_name, "div");

  free(tag_name);
  pm_parser_free(&parser);
END

TEST(test_extract_content_tag_name_string)
  pm_parser_t parser;
  const char* code = "content_tag \"span\"";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  char* tag_name = content_tag_handler.extract_tag_name(call_node, &parser);
  ck_assert_ptr_nonnull(tag_name);
  ck_assert_str_eq(tag_name, "span");

  free(tag_name);
  pm_parser_free(&parser);
END

TEST(test_extract_content_tag_name_complex)
  pm_parser_t parser;
  const char* code = "content_tag :custom_element";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  char* tag_name = content_tag_handler.extract_tag_name(call_node, &parser);
  ck_assert_ptr_nonnull(tag_name);
  ck_assert_str_eq(tag_name, "custom_element");

  free(tag_name);
  pm_parser_free(&parser);
END

TEST(test_extract_content_tag_content)
  pm_parser_t parser;
  const char* code = "content_tag :div, \"Hello World\"";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  char* content = content_tag_handler.extract_content(call_node, &parser);
  ck_assert_ptr_nonnull(content);
  ck_assert_str_eq(content, "Hello World");

  free(content);
  pm_parser_free(&parser);
END

TEST(test_extract_content_tag_no_content)
  pm_parser_t parser;
  const char* code = "content_tag :div";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  char* content = content_tag_handler.extract_content(call_node, &parser);
  ck_assert_ptr_null(content);

  pm_parser_free(&parser);
END

TEST(test_content_tag_supports_block)
  bool supports_block = content_tag_handler.supports_block();
  ck_assert(supports_block);
END

TCase *content_tag_handler_tests(void) {
  TCase *content_tag = tcase_create("ContentTagHandler");

  tcase_add_test(content_tag, test_detect_content_tag_basic);
  tcase_add_test(content_tag, test_detect_content_tag_with_string);
  tcase_add_test(content_tag, test_detect_content_tag_with_content);
  tcase_add_test(content_tag, test_detect_content_tag_false_positive);
  tcase_add_test(content_tag, test_extract_content_tag_name_symbol);
  tcase_add_test(content_tag, test_extract_content_tag_name_string);
  tcase_add_test(content_tag, test_extract_content_tag_name_complex);
  tcase_add_test(content_tag, test_extract_content_tag_content);
  tcase_add_test(content_tag, test_extract_content_tag_no_content);
  tcase_add_test(content_tag, test_content_tag_supports_block);

  return content_tag;
}
