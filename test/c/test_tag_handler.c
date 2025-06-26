#include "include/test.h"
#include "../../src/include/tag_helper_handler.h"
#include <prism.h>
#include <string.h>
#include <stdlib.h>

extern tag_helper_handler_T tag_dot_handler;

static pm_call_node_t* create_test_call_node(const char* code, pm_parser_t* parser) {
  pm_node_t* root = pm_parse(parser);
  if (!root || root->type != PM_PROGRAM_NODE) return NULL;

  pm_program_node_t* program = (pm_program_node_t*) root;
  if (!program->statements->body.size || program->statements->body.nodes[0]->type != PM_CALL_NODE) return NULL;

  return (pm_call_node_t*) program->statements->body.nodes[0];
}

TEST(test_detect_tag_dot_basic)
  pm_parser_t parser;
  const char* code = "tag.div";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  bool result = tag_dot_handler.detect(call_node, &parser);
  ck_assert(result);

  pm_parser_free(&parser);
END

TEST(test_detect_tag_dot_with_content)
  pm_parser_t parser;
  const char* code = "tag.span \"Hello World\"";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  bool result = tag_dot_handler.detect(call_node, &parser);
  ck_assert(result);

  pm_parser_free(&parser);
END

TEST(test_detect_tag_dot_hyphenated)
  pm_parser_t parser;
  const char* code = "tag.custom_element";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  bool result = tag_dot_handler.detect(call_node, &parser);
  ck_assert(result);

  pm_parser_free(&parser);
END

TEST(test_detect_tag_dot_false_positive)
  pm_parser_t parser;
  const char* code = "other.method";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  bool result = tag_dot_handler.detect(call_node, &parser);
  ck_assert(!result);

  pm_parser_free(&parser);
END

TEST(test_detect_tag_dot_no_receiver)
  pm_parser_t parser;
  const char* code = "div";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  bool result = tag_dot_handler.detect(call_node, &parser);
  ck_assert(!result);

  pm_parser_free(&parser);
END

TEST(test_extract_tag_dot_name_basic)
  pm_parser_t parser;
  const char* code = "tag.div";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  char* tag_name = tag_dot_handler.extract_tag_name(call_node, &parser);
  ck_assert_ptr_nonnull(tag_name);
  ck_assert_str_eq(tag_name, "div");

  free(tag_name);
  pm_parser_free(&parser);
END

TEST(test_extract_tag_dot_name_span)
  pm_parser_t parser;
  const char* code = "tag.span";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  char* tag_name = tag_dot_handler.extract_tag_name(call_node, &parser);
  ck_assert_ptr_nonnull(tag_name);
  ck_assert_str_eq(tag_name, "span");

  free(tag_name);
  pm_parser_free(&parser);
END

TEST(test_extract_tag_dot_name_complex)
  pm_parser_t parser;
  const char* code = "tag.custom_element";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  char* tag_name = tag_dot_handler.extract_tag_name(call_node, &parser);
  ck_assert_ptr_nonnull(tag_name);
  ck_assert_str_eq(tag_name, "custom_element");

  free(tag_name);
  pm_parser_free(&parser);
END

TEST(test_extract_tag_dot_content)
  pm_parser_t parser;
  const char* code = "tag.div \"Hello World\"";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  char* content = tag_dot_handler.extract_content(call_node, &parser);
  ck_assert_ptr_nonnull(content);
  ck_assert_str_eq(content, "Hello World");

  free(content);
  pm_parser_free(&parser);
END

TEST(test_extract_tag_dot_no_content)
  pm_parser_t parser;
  const char* code = "tag.div";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  char* content = tag_dot_handler.extract_content(call_node, &parser);
  ck_assert_ptr_null(content);

  pm_parser_free(&parser);
END

TEST(test_tag_dot_supports_block)
  bool supports_block = tag_dot_handler.supports_block();
  ck_assert(supports_block);
END

TCase *tag_handler_tests(void) {
  TCase *tag = tcase_create("TagHandler");

  tcase_add_test(tag, test_detect_tag_dot_basic);
  tcase_add_test(tag, test_detect_tag_dot_with_content);
  tcase_add_test(tag, test_detect_tag_dot_hyphenated);
  tcase_add_test(tag, test_detect_tag_dot_false_positive);
  tcase_add_test(tag, test_detect_tag_dot_no_receiver);
  tcase_add_test(tag, test_extract_tag_dot_name_basic);
  tcase_add_test(tag, test_extract_tag_dot_name_span);
  tcase_add_test(tag, test_extract_tag_dot_name_complex);
  tcase_add_test(tag, test_extract_tag_dot_content);
  tcase_add_test(tag, test_extract_tag_dot_no_content);
  tcase_add_test(tag, test_tag_dot_supports_block);

  return tag;
}
