#include "include/test.h"

#include "../../src/include/analyze_tag_helpers.h"
#include "../../src/include/position.h"

#include <prism.h>
#include <string.h>
#include <stdlib.h>

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

  pm_program_node_t* program = (pm_program_node_t*) root;
  if (!program->statements->body.size || program->statements->body.nodes[0]->type != PM_CALL_NODE) return NULL;

  return (pm_call_node_t*) program->statements->body.nodes[0];
}

TEST(test_extract_keyword_arguments_basic)
  pm_parser_t parser;
  const char* code = "content_tag :div, class: \"container\"";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  array_T* attributes = extract_keyword_arguments_from_call_node(
    (pm_node_t*) call_node,
    (const uint8_t*) code,
    code,
    0
  );

  ck_assert_ptr_nonnull(attributes);
  ck_assert_int_eq(array_size(attributes), 1);

  // Check the attribute key and value
  AST_HTML_ATTRIBUTE_NODE_T* class_attr = (AST_HTML_ATTRIBUTE_NODE_T*)array_get(attributes, 0);
  ck_assert_ptr_nonnull(class_attr);
  ck_assert_str_eq(class_attr->name->name->value, "class");

  char* class_value = extract_simple_attribute_value(class_attr->value);
  ck_assert_ptr_nonnull(class_value);
  ck_assert_str_eq(class_value, "container");
  free(class_value);

  array_free(&attributes);
  pm_parser_free(&parser);
END

TEST(test_extract_keyword_arguments_multiple)
  pm_parser_t parser;
  const char* code = "content_tag :div, class: \"container\", id: \"main\"";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  array_T* attributes = extract_keyword_arguments_from_call_node(
    (pm_node_t*) call_node,
    (const uint8_t*) code,
    code,
    0
  );

  ck_assert_ptr_nonnull(attributes);
  ck_assert_int_eq(array_size(attributes), 2);

  // Check both attributes
  AST_HTML_ATTRIBUTE_NODE_T* class_attr = (AST_HTML_ATTRIBUTE_NODE_T*)array_get(attributes, 0);
  AST_HTML_ATTRIBUTE_NODE_T* id_attr = (AST_HTML_ATTRIBUTE_NODE_T*)array_get(attributes, 1);

  ck_assert_ptr_nonnull(class_attr);
  ck_assert_ptr_nonnull(id_attr);

  ck_assert_str_eq(class_attr->name->name->value, "class");
  ck_assert_str_eq(id_attr->name->name->value, "id");

  char* class_value = extract_simple_attribute_value(class_attr->value);
  char* id_value = extract_simple_attribute_value(id_attr->value);

  ck_assert_ptr_nonnull(class_value);
  ck_assert_ptr_nonnull(id_value);
  ck_assert_str_eq(class_value, "container");
  ck_assert_str_eq(id_value, "main");

  free(class_value);
  free(id_value);

  array_free(&attributes);
  pm_parser_free(&parser);
END

TEST(test_extract_keyword_arguments_tag_dot)
  pm_parser_t parser;
  const char* code = "tag.div class: \"btn\", disabled: \"true\"";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  array_T* attributes = extract_keyword_arguments_from_call_node(
    (pm_node_t*) call_node,
    (const uint8_t*) code,
    code,
    0
  );

  ck_assert_ptr_nonnull(attributes);
  ck_assert_int_eq(array_size(attributes), 2);

  // Check both attributes
  AST_HTML_ATTRIBUTE_NODE_T* class_attr = (AST_HTML_ATTRIBUTE_NODE_T*)array_get(attributes, 0);
  AST_HTML_ATTRIBUTE_NODE_T* disabled_attr = (AST_HTML_ATTRIBUTE_NODE_T*)array_get(attributes, 1);

  ck_assert_ptr_nonnull(class_attr);
  ck_assert_ptr_nonnull(disabled_attr);

  ck_assert_str_eq(class_attr->name->name->value, "class");
  ck_assert_str_eq(disabled_attr->name->name->value, "disabled");

  char* class_value = extract_simple_attribute_value(class_attr->value);
  char* disabled_value = extract_simple_attribute_value(disabled_attr->value);

  ck_assert_ptr_nonnull(class_value);
  ck_assert_ptr_nonnull(disabled_value);
  ck_assert_str_eq(class_value, "btn");
  ck_assert_str_eq(disabled_value, "true");

  free(class_value);
  free(disabled_value);

  array_free(&attributes);
  pm_parser_free(&parser);
END

TEST(test_extract_keyword_arguments_none)
  pm_parser_t parser;
  const char* code = "content_tag :div";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  array_T* attributes = extract_keyword_arguments_from_call_node(
    (pm_node_t*) call_node,
    (const uint8_t*) code,
    code,
    0
  );

  ck_assert_ptr_nonnull(attributes);
  ck_assert_int_eq(array_size(attributes), 0);

  array_free(&attributes);
  pm_parser_free(&parser);
END

TEST(test_extract_keyword_arguments_from_helper_content_tag)
  const char* code = "content_tag :div, class: \"container\"";
  position_T* default_pos = position_init(1, 1);

  array_T* attributes = extract_keyword_arguments_from_helper(
    code,
    default_pos,
    code,
    0
  );

  ck_assert_ptr_nonnull(attributes);
  ck_assert_int_eq(array_size(attributes), 1);

  array_free(&attributes);
END

TEST(test_extract_keyword_arguments_from_helper_tag_dot)
  const char* code = "tag.span id: \"test\", data_value: \"123\"";
  position_T* default_pos = position_init(1, 1);

  array_T* attributes = extract_keyword_arguments_from_helper(
    code,
    default_pos,
    code,
    0
  );

  ck_assert_ptr_nonnull(attributes);
  ck_assert_int_eq(array_size(attributes), 2);

  array_free(&attributes);
END

TEST(test_has_tag_helper_attributes_true)
  const char* code = "content_tag :div, class: \"container\"";

  bool has_attrs = has_tag_helper_attributes(code);
  ck_assert(has_attrs);
END

TEST(test_has_tag_helper_attributes_false)
  const char* code = "content_tag :div";

  bool has_attrs = has_tag_helper_attributes(code);
  ck_assert(!has_attrs);
END

TEST(test_has_tag_helper_attributes_tag_dot_true)
  const char* code = "tag.div class: \"btn\"";

  bool has_attrs = has_tag_helper_attributes(code);
  ck_assert(has_attrs);
END

TEST(test_has_tag_helper_attributes_tag_dot_false)
  const char* code = "tag.div";

  bool has_attrs = has_tag_helper_attributes(code);
  ck_assert(!has_attrs);
END

TEST(test_complex_method_call_expression)
  pm_parser_t parser;
  const char* code = "content_tag :div, class: class_names(\"btn\", \"hello world\")";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  array_T* attributes = extract_keyword_arguments_from_call_node(
    (pm_node_t*) call_node,
    (const uint8_t*) code,
    code,
    0
  );

  ck_assert_ptr_nonnull(attributes);
  ck_assert_int_eq(array_size(attributes), 1);

  // Check the attribute key and complex value
  AST_HTML_ATTRIBUTE_NODE_T* class_attr = (AST_HTML_ATTRIBUTE_NODE_T*)array_get(attributes, 0);
  ck_assert_ptr_nonnull(class_attr);
  ck_assert_str_eq(class_attr->name->name->value, "class");

  char* class_value = extract_attribute_value_content(class_attr->value, code);
  ck_assert_ptr_nonnull(class_value);

  // Or check the exact value
  ck_assert_str_eq(class_value, "class_names(\"btn\", \"hello world\")");

  free(class_value);

  array_free(&attributes);
  pm_parser_free(&parser);
END

TEST(test_data_hash_attributes)
  pm_parser_t parser;
  const char* code = "tag.div data: { controller: \"example\", \"action\" => \"click\" }";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  array_T* attributes = extract_keyword_arguments_from_call_node(
    (pm_node_t*) call_node,
    (const uint8_t*) code,
    code,
    0
  );

  ck_assert_ptr_nonnull(attributes);
  ck_assert_int_eq(array_size(attributes), 2);

  // Check first data attribute (data-controller)
  AST_HTML_ATTRIBUTE_NODE_T* data_controller_attr = (AST_HTML_ATTRIBUTE_NODE_T*)array_get(attributes, 0);
  ck_assert_ptr_nonnull(data_controller_attr);
  ck_assert_str_eq(data_controller_attr->name->name->value, "data-controller");

  char* controller_value = extract_attribute_value_content(data_controller_attr->value, code);
  ck_assert_ptr_nonnull(controller_value);
  ck_assert_str_eq(controller_value, "example");

  // Check second data attribute (data-action)
  AST_HTML_ATTRIBUTE_NODE_T* data_action_attr = (AST_HTML_ATTRIBUTE_NODE_T*)array_get(attributes, 1);
  ck_assert_ptr_nonnull(data_action_attr);
  ck_assert_str_eq(data_action_attr->name->name->value, "data-action");

  char* action_value = extract_attribute_value_content(data_action_attr->value, code);
  ck_assert_ptr_nonnull(action_value);
  ck_assert_str_eq(action_value, "click");

  free(controller_value);
  free(action_value);

  array_free(&attributes);
  pm_parser_free(&parser);
END

TEST(test_aria_hash_attributes)
  pm_parser_t parser;
  const char* code = "tag.button aria: { label: \"Close\", \"expanded\" => \"false\" }";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  array_T* attributes = extract_keyword_arguments_from_call_node(
    (pm_node_t*) call_node,
    (const uint8_t*) code,
    code,
    0
  );

  ck_assert_ptr_nonnull(attributes);
  ck_assert_int_eq(array_size(attributes), 2);

  // Check first aria attribute (aria-label)
  AST_HTML_ATTRIBUTE_NODE_T* aria_label_attr = (AST_HTML_ATTRIBUTE_NODE_T*)array_get(attributes, 0);
  ck_assert_ptr_nonnull(aria_label_attr);
  ck_assert_str_eq(aria_label_attr->name->name->value, "aria-label");

  char* label_value = extract_attribute_value_content(aria_label_attr->value, code);
  ck_assert_ptr_nonnull(label_value);
  ck_assert_str_eq(label_value, "Close");

  // Check second aria attribute (aria-expanded)
  AST_HTML_ATTRIBUTE_NODE_T* aria_expanded_attr = (AST_HTML_ATTRIBUTE_NODE_T*)array_get(attributes, 1);
  ck_assert_ptr_nonnull(aria_expanded_attr);
  ck_assert_str_eq(aria_expanded_attr->name->name->value, "aria-expanded");

  char* expanded_value = extract_attribute_value_content(aria_expanded_attr->value, code);
  ck_assert_ptr_nonnull(expanded_value);
  ck_assert_str_eq(expanded_value, "false");

  free(label_value);
  free(expanded_value);

  array_free(&attributes);
  pm_parser_free(&parser);
END


TEST(test_underscore_to_dash_conversion)
  pm_parser_t parser;
  const char* code = "tag.div data_controller: \"hello\", aria_label: \"Close\", data_user_id: \"123\"";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  array_T* attributes = extract_keyword_arguments_from_call_node(
    (pm_node_t*) call_node,
    (const uint8_t*) code,
    code,
    0
  );

  ck_assert_ptr_nonnull(attributes);
  ck_assert_int_eq(array_size(attributes), 3);

  // Check data_controller becomes data-controller
  AST_HTML_ATTRIBUTE_NODE_T* data_controller_attr = (AST_HTML_ATTRIBUTE_NODE_T*)array_get(attributes, 0);
  ck_assert_ptr_nonnull(data_controller_attr);
  ck_assert_str_eq(data_controller_attr->name->name->value, "data-controller");

  char* controller_value = extract_attribute_value_content(data_controller_attr->value, code);
  ck_assert_ptr_nonnull(controller_value);
  ck_assert_str_eq(controller_value, "hello");

  // Check aria_label becomes aria-label
  AST_HTML_ATTRIBUTE_NODE_T* aria_label_attr = (AST_HTML_ATTRIBUTE_NODE_T*)array_get(attributes, 1);
  ck_assert_ptr_nonnull(aria_label_attr);
  ck_assert_str_eq(aria_label_attr->name->name->value, "aria-label");

  char* label_value = extract_attribute_value_content(aria_label_attr->value, code);
  ck_assert_ptr_nonnull(label_value);
  ck_assert_str_eq(label_value, "Close");

  // Check data_user_id becomes data-user-id
  AST_HTML_ATTRIBUTE_NODE_T* data_user_id_attr = (AST_HTML_ATTRIBUTE_NODE_T*)array_get(attributes, 2);
  ck_assert_ptr_nonnull(data_user_id_attr);
  ck_assert_str_eq(data_user_id_attr->name->name->value, "data-user-id");

  char* user_id_value = extract_attribute_value_content(data_user_id_attr->value, code);
  ck_assert_ptr_nonnull(user_id_value);
  ck_assert_str_eq(user_id_value, "123");

  free(controller_value);
  free(label_value);
  free(user_id_value);

  array_free(&attributes);
  pm_parser_free(&parser);
END

TEST(test_data_hash_complex_values)
  pm_parser_t parser;
  const char* code = "tag.div data: { controller: some_variable, :action => \"#{some_variable}\" }";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  array_T* attributes = extract_keyword_arguments_from_call_node(
    (pm_node_t*) call_node,
    (const uint8_t*) code,
    code,
    0
  );

  ck_assert_ptr_nonnull(attributes);
  ck_assert_int_eq(array_size(attributes), 2);

  // Check first data attribute (data-controller with variable)
  AST_HTML_ATTRIBUTE_NODE_T* data_controller_attr = (AST_HTML_ATTRIBUTE_NODE_T*)array_get(attributes, 0);
  ck_assert_ptr_nonnull(data_controller_attr);
  ck_assert_str_eq(data_controller_attr->name->name->value, "data-controller");

  // Verify that the value contains a RubyLiteralNode
  ck_assert_ptr_nonnull(data_controller_attr->value);
  ck_assert_ptr_nonnull(data_controller_attr->value->children);
  ck_assert_int_gt(data_controller_attr->value->children->size, 0);

  // Find the RubyLiteralNode in the children
  bool found_ruby_literal_controller = false;
  for (size_t i = 0; i < data_controller_attr->value->children->size; i++) {
    AST_NODE_T* child = (AST_NODE_T*)data_controller_attr->value->children->items[i];
    if (child && child->type == AST_RUBY_LITERAL_NODE) {
      AST_RUBY_LITERAL_NODE_T* ruby_node = (AST_RUBY_LITERAL_NODE_T*)child;
      ck_assert_ptr_nonnull(ruby_node->content);
      ck_assert_str_eq(ruby_node->content, "some_variable");
      found_ruby_literal_controller = true;
      break;
    }
  }
  ck_assert(found_ruby_literal_controller);

  // Check second data attribute (data-action with string interpolation)
  AST_HTML_ATTRIBUTE_NODE_T* data_action_attr = (AST_HTML_ATTRIBUTE_NODE_T*)array_get(attributes, 1);
  ck_assert_ptr_nonnull(data_action_attr);
  ck_assert_str_eq(data_action_attr->name->name->value, "data-action");

  // Verify that the value contains a RubyLiteralNode
  ck_assert_ptr_nonnull(data_action_attr->value);
  ck_assert_ptr_nonnull(data_action_attr->value->children);
  ck_assert_int_gt(data_action_attr->value->children->size, 0);

  // Find the RubyLiteralNode in the children
  bool found_ruby_literal_action = false;

  for (size_t i = 0; i < data_action_attr->value->children->size; i++) {
    AST_NODE_T* child = (AST_NODE_T*)data_action_attr->value->children->items[i];
    if (child && child->type == AST_RUBY_LITERAL_NODE) {
      AST_RUBY_LITERAL_NODE_T* ruby_node = (AST_RUBY_LITERAL_NODE_T*)child;
      ck_assert_ptr_nonnull(ruby_node->content);
      ck_assert_str_eq(ruby_node->content, "\"#{some_variable}\"");
      found_ruby_literal_action = true;
      break;
    }
  }

  ck_assert(found_ruby_literal_action);

  array_free(&attributes);
  pm_parser_free(&parser);
END

TEST(test_splat_attributes)
  pm_parser_t parser;
  const char* code = "tag.div id: \"123\", class: \"container\", **attributes";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  array_T* attributes = extract_keyword_arguments_from_call_node(
    (pm_node_t*) call_node,
    (const uint8_t*) code,
    code,
    0
  );

  ck_assert_ptr_nonnull(attributes);
  ck_assert_int_eq(array_size(attributes), 3);

  // Check regular attributes first
  AST_HTML_ATTRIBUTE_NODE_T* id_attr = (AST_HTML_ATTRIBUTE_NODE_T*)array_get(attributes, 0);
  AST_HTML_ATTRIBUTE_NODE_T* class_attr = (AST_HTML_ATTRIBUTE_NODE_T*)array_get(attributes, 1);

  ck_assert_ptr_nonnull(id_attr);
  ck_assert_ptr_nonnull(class_attr);
  ck_assert_str_eq(id_attr->name->name->value, "id");
  ck_assert_str_eq(class_attr->name->name->value, "class");

  // Check splat - should be an HTMLAttributeRubySplatNode directly in the attributes array
  AST_NODE_T* splat_node = (AST_NODE_T*)array_get(attributes, 2);
  ck_assert_ptr_nonnull(splat_node);
  ck_assert_int_eq(splat_node->type, AST_HTML_ATTRIBUTE_RUBY_SPLAT_NODE);

  // Cast to HTMLAttributeRubySplatNode and verify content
  AST_HTML_ATTRIBUTE_RUBY_SPLAT_NODE_T* splat_ruby_node = (AST_HTML_ATTRIBUTE_RUBY_SPLAT_NODE_T*)splat_node;
  ck_assert_ptr_nonnull(splat_ruby_node->content);
  ck_assert_str_eq(splat_ruby_node->content, "**attributes");
  ck_assert_str_eq(splat_ruby_node->prefix, ""); // Top-level splat has empty prefix

  array_free(&attributes);
  pm_parser_free(&parser);
END

TEST(test_data_hash_with_splat)
  pm_parser_t parser;
  const char* code = "tag.div data: { controller: \"example\", action: \"click\", **data_attributes }";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  array_T* attributes = extract_keyword_arguments_from_call_node(
    (pm_node_t*) call_node,
    (const uint8_t*) code,
    code,
    0
  );

  ck_assert_ptr_nonnull(attributes);
  ck_assert_int_eq(array_size(attributes), 3);

  // Check first data attribute (data-controller)
  AST_HTML_ATTRIBUTE_NODE_T* data_controller_attr = (AST_HTML_ATTRIBUTE_NODE_T*)array_get(attributes, 0);
  ck_assert_ptr_nonnull(data_controller_attr);
  ck_assert_int_eq(data_controller_attr->base.type, AST_HTML_ATTRIBUTE_NODE);
  ck_assert_str_eq(data_controller_attr->name->name->value, "data-controller");

  char* controller_value = extract_attribute_value_content(data_controller_attr->value, code);
  ck_assert_ptr_nonnull(controller_value);
  ck_assert_str_eq(controller_value, "example");

  // Check second data attribute (data-action)
  AST_HTML_ATTRIBUTE_NODE_T* data_action_attr = (AST_HTML_ATTRIBUTE_NODE_T*)array_get(attributes, 1);
  ck_assert_ptr_nonnull(data_action_attr);
  ck_assert_int_eq(data_action_attr->base.type, AST_HTML_ATTRIBUTE_NODE);
  ck_assert_str_eq(data_action_attr->name->name->value, "data-action");

  char* action_value = extract_attribute_value_content(data_action_attr->value, code);
  ck_assert_ptr_nonnull(action_value);
  ck_assert_str_eq(action_value, "click");

  // Check splat - should be an HTMLAttributeRubySplatNode directly in the attributes array
  AST_NODE_T* splat_node = (AST_NODE_T*)array_get(attributes, 2);
  ck_assert_ptr_nonnull(splat_node);
  ck_assert_int_eq(splat_node->type, AST_HTML_ATTRIBUTE_RUBY_SPLAT_NODE);

  // Cast to HTMLAttributeRubySplatNode and verify content and prefix
  AST_HTML_ATTRIBUTE_RUBY_SPLAT_NODE_T* splat_ruby_node = (AST_HTML_ATTRIBUTE_RUBY_SPLAT_NODE_T*)splat_node;
  ck_assert_ptr_nonnull(splat_ruby_node->content);
  ck_assert_str_eq(splat_ruby_node->content, "**data_attributes");
  ck_assert_ptr_nonnull(splat_ruby_node->prefix);
  ck_assert_str_eq(splat_ruby_node->prefix, "data");

  free(controller_value);
  free(action_value);

  array_free(&attributes);
  pm_parser_free(&parser);
END

TEST(test_interpolated_string_attributes)
  pm_parser_t parser;
  const char* code = "tag.div class: \"before_#{variable}_after\"";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  array_T* attributes = extract_keyword_arguments_from_call_node(
    (pm_node_t*) call_node,
    (const uint8_t*) code,
    code,
    0
  );

  ck_assert_ptr_nonnull(attributes);
  ck_assert_int_eq(array_size(attributes), 1);

  // Check the class attribute
  AST_HTML_ATTRIBUTE_NODE_T* class_attr = (AST_HTML_ATTRIBUTE_NODE_T*)array_get(attributes, 0);
  ck_assert_ptr_nonnull(class_attr);
  ck_assert_str_eq(class_attr->name->name->value, "class");

  // Check that the value contains multiple children (3 parts: "before_", variable, "_after")
  ck_assert_ptr_nonnull(class_attr->value);
  ck_assert_ptr_nonnull(class_attr->value->children);
  ck_assert_int_eq(class_attr->value->children->size, 3);

  // Check first part: "before_" (LiteralNode)
  AST_NODE_T* first_child = (AST_NODE_T*)class_attr->value->children->items[0];
  ck_assert_ptr_nonnull(first_child);
  ck_assert_int_eq(first_child->type, AST_LITERAL_NODE);
  AST_LITERAL_NODE_T* literal1 = (AST_LITERAL_NODE_T*)first_child;
  ck_assert_str_eq(literal1->content, "before_");

  // Check second part: #{variable} (RubyLiteralNode with interpolation wrapper)
  AST_NODE_T* second_child = (AST_NODE_T*)class_attr->value->children->items[1];
  ck_assert_ptr_nonnull(second_child);
  ck_assert_int_eq(second_child->type, AST_RUBY_LITERAL_NODE);
  AST_RUBY_LITERAL_NODE_T* ruby_literal = (AST_RUBY_LITERAL_NODE_T*)second_child;
  ck_assert_str_eq(ruby_literal->content, "#{variable}");

  // Check third part: "_after" (LiteralNode)
  AST_NODE_T* third_child = (AST_NODE_T*)class_attr->value->children->items[2];
  ck_assert_ptr_nonnull(third_child);
  ck_assert_int_eq(third_child->type, AST_LITERAL_NODE);
  AST_LITERAL_NODE_T* literal2 = (AST_LITERAL_NODE_T*)third_child;
  ck_assert_str_eq(literal2->content, "_after");

  array_free(&attributes);
  pm_parser_free(&parser);
END

TEST(test_complex_interpolated_string_attributes)
  pm_parser_t parser;
  const char* code = "tag.div title: \"User: #{user.name} (#{user.id})\"";
  pm_parser_init(&parser, (const uint8_t*) code, strlen(code), NULL);

  pm_call_node_t* call_node = create_test_call_node(code, &parser);
  ck_assert_ptr_nonnull(call_node);

  array_T* attributes = extract_keyword_arguments_from_call_node(
    (pm_node_t*) call_node,
    (const uint8_t*) code,
    code,
    0
  );

  ck_assert_ptr_nonnull(attributes);
  ck_assert_int_eq(array_size(attributes), 1);

  // Check the title attribute
  AST_HTML_ATTRIBUTE_NODE_T* title_attr = (AST_HTML_ATTRIBUTE_NODE_T*)array_get(attributes, 0);
  ck_assert_ptr_nonnull(title_attr);
  ck_assert_str_eq(title_attr->name->name->value, "title");

  // Check that the value contains 5 parts: "User: ", #{user.name}, " (", #{user.id}, ")"
  ck_assert_ptr_nonnull(title_attr->value);
  ck_assert_ptr_nonnull(title_attr->value->children);
  ck_assert_int_eq(title_attr->value->children->size, 5);

  // Check first part: "User: " (LiteralNode)
  AST_NODE_T* part1 = (AST_NODE_T*)title_attr->value->children->items[0];
  ck_assert_int_eq(part1->type, AST_LITERAL_NODE);
  AST_LITERAL_NODE_T* literal1 = (AST_LITERAL_NODE_T*)part1;
  ck_assert_str_eq(literal1->content, "User: ");

  // Check second part: #{user.name} (RubyLiteralNode)
  AST_NODE_T* part2 = (AST_NODE_T*)title_attr->value->children->items[1];
  ck_assert_int_eq(part2->type, AST_RUBY_LITERAL_NODE);
  AST_RUBY_LITERAL_NODE_T* ruby1 = (AST_RUBY_LITERAL_NODE_T*)part2;
  ck_assert_str_eq(ruby1->content, "#{user.name}");

  // Check third part: " (" (LiteralNode)
  AST_NODE_T* part3 = (AST_NODE_T*)title_attr->value->children->items[2];
  ck_assert_int_eq(part3->type, AST_LITERAL_NODE);
  AST_LITERAL_NODE_T* literal2 = (AST_LITERAL_NODE_T*)part3;
  ck_assert_str_eq(literal2->content, " (");

  // Check fourth part: #{user.id} (RubyLiteralNode)
  AST_NODE_T* part4 = (AST_NODE_T*)title_attr->value->children->items[3];
  ck_assert_int_eq(part4->type, AST_RUBY_LITERAL_NODE);
  AST_RUBY_LITERAL_NODE_T* ruby2 = (AST_RUBY_LITERAL_NODE_T*)part4;
  ck_assert_str_eq(ruby2->content, "#{user.id}");

  // Check fifth part: ")" (LiteralNode)
  AST_NODE_T* part5 = (AST_NODE_T*)title_attr->value->children->items[4];
  ck_assert_int_eq(part5->type, AST_LITERAL_NODE);
  AST_LITERAL_NODE_T* literal3 = (AST_LITERAL_NODE_T*)part5;
  ck_assert_str_eq(literal3->content, ")");

  array_free(&attributes);
  pm_parser_free(&parser);
END

TCase *keyword_arguments_tests(void) {
  TCase *keyword_args = tcase_create("KeywordArguments");

  tcase_add_test(keyword_args, test_extract_keyword_arguments_basic);
  tcase_add_test(keyword_args, test_extract_keyword_arguments_multiple);
  tcase_add_test(keyword_args, test_extract_keyword_arguments_tag_dot);
  tcase_add_test(keyword_args, test_extract_keyword_arguments_none);
  tcase_add_test(keyword_args, test_extract_keyword_arguments_from_helper_content_tag);
  tcase_add_test(keyword_args, test_extract_keyword_arguments_from_helper_tag_dot);
  tcase_add_test(keyword_args, test_has_tag_helper_attributes_true);
  tcase_add_test(keyword_args, test_has_tag_helper_attributes_false);
  tcase_add_test(keyword_args, test_has_tag_helper_attributes_tag_dot_true);
  tcase_add_test(keyword_args, test_has_tag_helper_attributes_tag_dot_false);
  tcase_add_test(keyword_args, test_complex_method_call_expression);
  tcase_add_test(keyword_args, test_data_hash_attributes);
  tcase_add_test(keyword_args, test_aria_hash_attributes);
  tcase_add_test(keyword_args, test_underscore_to_dash_conversion);
  tcase_add_test(keyword_args, test_data_hash_complex_values);
  tcase_add_test(keyword_args, test_splat_attributes);
  tcase_add_test(keyword_args, test_data_hash_with_splat);
  tcase_add_test(keyword_args, test_interpolated_string_attributes);
  tcase_add_test(keyword_args, test_complex_interpolated_string_attributes);

  return keyword_args;
}
