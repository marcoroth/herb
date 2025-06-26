#include "include/test.h"
#include "../../src/include/analyze_tag_helpers.h"
#include "../../src/include/tag_helper_handler.h"
#include "../../src/include/attribute_extraction_helpers.h"

// Helper function to extract value from HTML attribute value node
// Returns either simple string content or Ruby literal for complex expressions
static char* extract_attribute_value_content(AST_HTML_ATTRIBUTE_VALUE_NODE_T* value_node, const char* original_source) {
  if (!value_node || !value_node->children || value_node->children->size == 0) {
    return NULL;
  }

  // For simple string values, children should contain one AST_HTML_TEXT_NODE_T
  if (value_node->children->size == 1) {
    AST_NODE_T* first_child = (AST_NODE_T*)value_node->children->items[0];
    if (first_child && first_child->type == AST_HTML_TEXT_NODE) {
      AST_HTML_TEXT_NODE_T* text_node = (AST_HTML_TEXT_NODE_T*)first_child;
      return text_node->content ? strdup(text_node->content) : NULL;
    }
  }

  // For complex values, look for RubyLiteralNode and extract the raw Ruby code
  for (size_t i = 0; i < value_node->children->size; i++) {
    AST_NODE_T* child = (AST_NODE_T*)value_node->children->items[i];
    if (child && child->type == AST_RUBY_LITERAL_NODE) {
      AST_RUBY_LITERAL_NODE_T* ruby_node = (AST_RUBY_LITERAL_NODE_T*)child;
      return ruby_node->content ? strdup(ruby_node->content) : NULL;
    }
  }

  return NULL;
}

// Helper function for simple string values only (backwards compatibility)
static char* extract_simple_attribute_value(AST_HTML_ATTRIBUTE_VALUE_NODE_T* value_node) {
  return extract_attribute_value_content(value_node, NULL);
}

static pm_call_node_t* create_test_call_node(const char* code, pm_parser_t* parser) {
  pm_node_t* root = pm_parse(parser);
  if (!root || root->type != PM_PROGRAM_NODE) return NULL;

  pm_program_node_t* program = (pm_program_node_t*)root;
  if (!program->statements->body.size || program->statements->body.nodes[0]->type != PM_CALL_NODE) return NULL;

  return (pm_call_node_t*)program->statements->body.nodes[0];
}

TEST(test_extract_simple_attributes)
  pm_parser_t parser;
  const char* code = "tag.div id: \"123\", class: \"container\"";
  pm_parser_init(&parser, (const uint8_t*)code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  bool has_attrs = has_html_attributes_in_call(call_node);
  ck_assert(has_attrs == true);

  array_T* attributes = extract_html_attributes_from_call_node(
    call_node, (const uint8_t*)code, code, 0
  );

  ck_assert_ptr_nonnull(attributes);
  ck_assert_int_eq(attributes->size, 2);

  AST_HTML_ATTRIBUTE_NODE_T* id_attr = (AST_HTML_ATTRIBUTE_NODE_T*)attributes->items[0];
  AST_HTML_ATTRIBUTE_NODE_T* class_attr = (AST_HTML_ATTRIBUTE_NODE_T*)attributes->items[1];

  ck_assert_str_eq(id_attr->name->name->value, "id");
  ck_assert_str_eq(class_attr->name->name->value, "class");


  // Check attribute values
  char* id_value = extract_simple_attribute_value(id_attr->value);
  char* class_value = extract_simple_attribute_value(class_attr->value);
  
  ck_assert_ptr_nonnull(id_value);
  ck_assert_ptr_nonnull(class_value);
  ck_assert_str_eq(id_value, "123");
  ck_assert_str_eq(class_value, "container");
  
  free(id_value);
  free(class_value);

  pm_parser_free(&parser);
END

TEST(test_extract_complex_attributes)
  pm_parser_t parser;
  const char* code = "tag.div class: class_list(\"btn\"), data: { controller: \"test\" }";
  pm_parser_init(&parser, (const uint8_t*)code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  array_T* attributes = extract_html_attributes_from_call_node(
    call_node, (const uint8_t*)code, code, 0
  );

  ck_assert_ptr_nonnull(attributes);
  ck_assert_int_eq(attributes->size, 2);

  AST_HTML_ATTRIBUTE_NODE_T* class_attr = (AST_HTML_ATTRIBUTE_NODE_T*)attributes->items[0];
  AST_HTML_ATTRIBUTE_NODE_T* data_controller_attr = (AST_HTML_ATTRIBUTE_NODE_T*)attributes->items[1];

  ck_assert_str_eq(class_attr->name->name->value, "class");
  ck_assert_str_eq(data_controller_attr->name->name->value, "data-controller");

  // Check complex class value - should contain the Ruby expression
  char* class_value = extract_attribute_value_content(class_attr->value, code);
  ck_assert_ptr_nonnull(class_value);
  ck_assert_ptr_nonnull(strstr(class_value, "class_list"));
  
  // Check data-controller value - should be simple string
  char* data_value = extract_attribute_value_content(data_controller_attr->value, code);
  ck_assert_ptr_nonnull(data_value);
  ck_assert_str_eq(data_value, "test");
  
  free(class_value);
  free(data_value);

  pm_parser_free(&parser);
END

TEST(test_no_attributes)
  pm_parser_t parser;
  const char* code = "tag.div \"content\"";
  pm_parser_init(&parser, (const uint8_t*)code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  bool has_attrs = has_html_attributes_in_call(call_node);
  ck_assert(has_attrs == false);

  array_T* attributes = extract_html_attributes_from_call_node(
    call_node, (const uint8_t*)code, code, 0
  );

  ck_assert_ptr_null(attributes);

  pm_parser_free(&parser);
END

TEST(test_single_attribute)
  pm_parser_t parser;
  const char* code = "content_tag :div, \"Hello\", class: \"greeting\"";
  pm_parser_init(&parser, (const uint8_t*)code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  array_T* attributes = extract_html_attributes_from_call_node(
    call_node, (const uint8_t*)code, code, 0
  );

  ck_assert_ptr_nonnull(attributes);
  ck_assert_int_eq(attributes->size, 1);

  AST_HTML_ATTRIBUTE_NODE_T* class_attr = (AST_HTML_ATTRIBUTE_NODE_T*)attributes->items[0];
  ck_assert_str_eq(class_attr->name->name->value, "class");

  // Check attribute value
  char* class_value = extract_simple_attribute_value(class_attr->value);
  ck_assert_ptr_nonnull(class_value);
  ck_assert_str_eq(class_value, "greeting");
  free(class_value);

  pm_parser_free(&parser);
END

TEST(test_mixed_attributes)
  pm_parser_t parser;
  const char* code = "tag.div id: \"123\", class: class_list(\"btn btn-primary\"), disabled: true";
  pm_parser_init(&parser, (const uint8_t*)code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  array_T* attributes = extract_html_attributes_from_call_node(
    call_node, (const uint8_t*)code, code, 0
  );

  ck_assert_ptr_nonnull(attributes);
  ck_assert_int_eq(attributes->size, 3);

  AST_HTML_ATTRIBUTE_NODE_T* id_attr = (AST_HTML_ATTRIBUTE_NODE_T*)attributes->items[0];
  AST_HTML_ATTRIBUTE_NODE_T* class_attr = (AST_HTML_ATTRIBUTE_NODE_T*)attributes->items[1];
  AST_HTML_ATTRIBUTE_NODE_T* disabled_attr = (AST_HTML_ATTRIBUTE_NODE_T*)attributes->items[2];

  ck_assert_str_eq(id_attr->name->name->value, "id");
  ck_assert_str_eq(class_attr->name->name->value, "class");
  ck_assert_str_eq(disabled_attr->name->name->value, "disabled");

  // Check the simple string value (id should be "123")
  char* id_value = extract_simple_attribute_value(id_attr->value);
  ck_assert_ptr_nonnull(id_value);
  ck_assert_str_eq(id_value, "123");
  free(id_value);
  
  // Check complex values - should contain the Ruby expressions
  char* class_value = extract_attribute_value_content(class_attr->value, code);
  char* disabled_value = extract_attribute_value_content(disabled_attr->value, code);
  
  ck_assert_ptr_nonnull(class_value);
  ck_assert_ptr_nonnull(disabled_value);
  
  // Should contain the Ruby expressions as literal content
  ck_assert_ptr_nonnull(strstr(class_value, "class_list"));
  ck_assert_str_eq(disabled_value, "true");
  
  free(class_value);
  free(disabled_value);

  pm_parser_free(&parser);
END

TEST(test_complex_ruby_expression)
  pm_parser_t parser;
  const char* code = "tag.div class: class_names(\"btn\", \"hello world\")";
  pm_parser_init(&parser, (const uint8_t*)code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  array_T* attributes = extract_html_attributes_from_call_node(
    call_node, (const uint8_t*)code, code, 0
  );

  ck_assert_ptr_nonnull(attributes);
  ck_assert_int_eq(attributes->size, 1);

  AST_HTML_ATTRIBUTE_NODE_T* class_attr = (AST_HTML_ATTRIBUTE_NODE_T*)attributes->items[0];
  ck_assert_str_eq(class_attr->name->name->value, "class");

  // Check complex value - should contain the full Ruby expression
  char* class_value = extract_attribute_value_content(class_attr->value, code);
  ck_assert_ptr_nonnull(class_value);
  
  // Should contain the full method call with arguments
  ck_assert_ptr_nonnull(strstr(class_value, "class_names"));
  ck_assert_ptr_nonnull(strstr(class_value, "\"btn\""));
  ck_assert_ptr_nonnull(strstr(class_value, "\"hello world\""));
  
  free(class_value);

  pm_parser_free(&parser);
END

TCase *attribute_extraction_helpers_tests(void) {
  TCase *tc_core = tcase_create("AttributeExtractionHelpers");

  tcase_add_test(tc_core, test_extract_simple_attributes);
  tcase_add_test(tc_core, test_extract_complex_attributes);
  tcase_add_test(tc_core, test_no_attributes);
  tcase_add_test(tc_core, test_single_attribute);
  tcase_add_test(tc_core, test_mixed_attributes);
  tcase_add_test(tc_core, test_complex_ruby_expression);

  return tc_core;
}