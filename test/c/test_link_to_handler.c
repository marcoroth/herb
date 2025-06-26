#include "include/test.h"
#include "../../src/include/tag_helper_handler.h"
#include <prism.h>
#include <string.h>
#include <stdlib.h>

extern tag_helper_handler_T link_to_handler;

// Helper function to create a call node from Ruby code
static pm_call_node_t* create_test_call_node(const char* code, pm_parser_t* parser) {
  pm_node_t* root = pm_parse(parser);
  if (!root || root->type != PM_PROGRAM_NODE) return NULL;

  pm_program_node_t* program = (pm_program_node_t*) root;
  if (!program->statements->body.size || program->statements->body.nodes[0]->type != PM_CALL_NODE) return NULL;

  return (pm_call_node_t*) program->statements->body.nodes[0];
}

// Tests for detect_link_to function
TEST(test_detect_link_to_basic)
  pm_parser_t parser;
  const char* code = "link_to \"Home\", \"/\"";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  bool result = link_to_handler.detect(call_node, &parser);
  ck_assert(result);

  pm_parser_free(&parser);
END

TEST(test_detect_link_to_with_dynamic_path)
  pm_parser_t parser;
  const char* code = "link_to \"Home\", root_path";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  bool result = link_to_handler.detect(call_node, &parser);
  ck_assert(result);

  pm_parser_free(&parser);
END

TEST(test_detect_link_to_with_attributes)
  pm_parser_t parser;
  const char* code = "link_to \"Home\", root_path, class: \"btn\"";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  bool result = link_to_handler.detect(call_node, &parser);
  ck_assert(result);

  pm_parser_free(&parser);
END

TEST(test_detect_link_to_single_argument)
  pm_parser_t parser;
  const char* code = "link_to root_path";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  bool result = link_to_handler.detect(call_node, &parser);
  ck_assert(result);

  pm_parser_free(&parser);
END

TEST(test_detect_non_link_to_call)
  pm_parser_t parser;
  const char* code = "content_tag :div";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  bool result = link_to_handler.detect(call_node, &parser);
  ck_assert(!result);

  pm_parser_free(&parser);
END

TEST(test_detect_link_to_null_call_node)
  pm_parser_t parser;
  pm_parser_init(&parser, (const uint8_t*) "", 0, NULL);

  bool result = link_to_handler.detect(NULL, &parser);
  ck_assert(!result);

  pm_parser_free(&parser);
END

// Tests for extract_link_to_tag_name function
TEST(test_extract_link_to_tag_name)
  pm_parser_t parser;
  const char* code = "link_to \"Home\", \"/\"";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  char* tag_name = link_to_handler.extract_tag_name(call_node, &parser);
  ck_assert_ptr_nonnull(tag_name);
  ck_assert_str_eq(tag_name, "a");

  free(tag_name);
  pm_parser_free(&parser);
END

// Tests for extract_link_to_content function
TEST(test_extract_link_to_content_with_string_content)
  pm_parser_t parser;
  const char* code = "link_to \"Home\", \"/\"";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  char* content = link_to_handler.extract_content(call_node, &parser);
  ck_assert_ptr_nonnull(content);
  ck_assert_str_eq(content, "Home");

  free(content);
  pm_parser_free(&parser);
END

TEST(test_extract_link_to_content_with_dynamic_content)
  pm_parser_t parser;
  const char* code = "link_to user.name, user_path(user)";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  // Dynamic content should return NULL since it's not a string literal
  char* content = link_to_handler.extract_content(call_node, &parser);
  ck_assert_ptr_null(content);

  pm_parser_free(&parser);
END

TEST(test_extract_link_to_content_single_argument)
  pm_parser_t parser;
  const char* code = "link_to root_path";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  // Single argument form has no content (it's just a URL)
  char* content = link_to_handler.extract_content(call_node, &parser);
  ck_assert_ptr_null(content);

  pm_parser_free(&parser);
END

TEST(test_extract_link_to_content_no_arguments)
  pm_parser_t parser;
  const char* code = "link_to";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  char* content = link_to_handler.extract_content(call_node, &parser);
  ck_assert_ptr_null(content);

  pm_parser_free(&parser);
END

TEST(test_extract_link_to_content_null_call_node)
  pm_parser_t parser;
  pm_parser_init(&parser, (const uint8_t*) "", 0, NULL);

  char* content = link_to_handler.extract_content(NULL, &parser);
  ck_assert_ptr_null(content);

  pm_parser_free(&parser);
END

// Tests for link_to_supports_block function
TEST(test_link_to_supports_block)
  bool supports_block = link_to_handler.supports_block();
  ck_assert(supports_block);
END

// Tests for extract_link_to_href function (additional function in link_to.c)
extern char* extract_link_to_href(pm_call_node_t* call_node, pm_parser_t* parser);

TEST(test_extract_link_to_href_static_string)
  pm_parser_t parser;
  const char* code = "link_to \"Home\", \"/static/path\"";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  char* href = extract_link_to_href(call_node, &parser);
  ck_assert_ptr_nonnull(href);
  ck_assert_str_eq(href, "/static/path");

  free(href);
  pm_parser_free(&parser);
END

TEST(test_extract_link_to_href_dynamic_expression)
  pm_parser_t parser;
  const char* code = "link_to \"Home\", root_path";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  char* href = extract_link_to_href(call_node, &parser);
  ck_assert_ptr_nonnull(href);
  ck_assert_str_eq(href, "<%= root_path %>");

  free(href);
  pm_parser_free(&parser);
END

TEST(test_extract_link_to_href_complex_expression)
  pm_parser_t parser;
  const char* code = "link_to \"Post\", post_path(post)";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  char* href = extract_link_to_href(call_node, &parser);
  ck_assert_ptr_nonnull(href);
  ck_assert_str_eq(href, "<%= post_path(post) %>");

  free(href);
  pm_parser_free(&parser);
END

TEST(test_extract_link_to_href_single_argument)
  pm_parser_t parser;
  const char* code = "link_to \"/single\"";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  // Single argument has less than 2 arguments, should return NULL
  char* href = extract_link_to_href(call_node, &parser);
  ck_assert_ptr_null(href);

  pm_parser_free(&parser);
END

TEST(test_extract_link_to_href_no_arguments)
  pm_parser_t parser;
  const char* code = "link_to";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  char* href = extract_link_to_href(call_node, &parser);
  ck_assert_ptr_null(href);

  pm_parser_free(&parser);
END

TEST(test_extract_link_to_href_null_call_node)
  pm_parser_t parser;
  pm_parser_init(&parser, (const uint8_t*) "", 0, NULL);

  char* href = extract_link_to_href(NULL, &parser);
  ck_assert_ptr_null(href);

  pm_parser_free(&parser);
END

// Test suite registration
TCase *link_to_handler_tests(void) {
  TCase *tcase = tcase_create("link_to_handler");

  // Detection tests
  tcase_add_test(tcase, test_detect_link_to_basic);
  tcase_add_test(tcase, test_detect_link_to_with_dynamic_path);
  tcase_add_test(tcase, test_detect_link_to_with_attributes);
  tcase_add_test(tcase, test_detect_link_to_single_argument);
  tcase_add_test(tcase, test_detect_non_link_to_call);
  tcase_add_test(tcase, test_detect_link_to_null_call_node);

  // Tag name extraction tests
  tcase_add_test(tcase, test_extract_link_to_tag_name);

  // Content extraction tests
  tcase_add_test(tcase, test_extract_link_to_content_with_string_content);
  tcase_add_test(tcase, test_extract_link_to_content_with_dynamic_content);
  tcase_add_test(tcase, test_extract_link_to_content_single_argument);
  tcase_add_test(tcase, test_extract_link_to_content_no_arguments);
  tcase_add_test(tcase, test_extract_link_to_content_null_call_node);

  // Block support test
  tcase_add_test(tcase, test_link_to_supports_block);

  // Href extraction tests
  tcase_add_test(tcase, test_extract_link_to_href_static_string);
  tcase_add_test(tcase, test_extract_link_to_href_dynamic_expression);
  tcase_add_test(tcase, test_extract_link_to_href_complex_expression);
  tcase_add_test(tcase, test_extract_link_to_href_single_argument);
  tcase_add_test(tcase, test_extract_link_to_href_no_arguments);
  tcase_add_test(tcase, test_extract_link_to_href_null_call_node);

  return tcase;
}
