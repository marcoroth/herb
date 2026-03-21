#ifndef HERB_ANALYZE_TAG_HELPER_NODE_BUILDERS_H
#define HERB_ANALYZE_TAG_HELPER_NODE_BUILDERS_H

#include "../../ast/ast_nodes.h"
#include "../../lexer/token_struct.h"
#include "../../lib/hb_allocator.h"
#include "../../lib/hb_array.h"
#include "../../location/position.h"

#include <prism.h>

token_T* create_synthetic_token(
  hb_allocator_T* allocator,
  const char* value,
  token_type_T type,
  position_T start,
  position_T end
);

AST_HTML_ATTRIBUTE_NAME_NODE_T* create_attribute_name_node(
  const char* name_string,
  position_T start_position,
  position_T end_position,
  hb_allocator_T* allocator
);

AST_HTML_ATTRIBUTE_NODE_T* create_html_attribute_node(
  const char* name_string,
  const char* value_string,
  position_T start_position,
  position_T end_position,
  hb_allocator_T* allocator
);

AST_HTML_ATTRIBUTE_NODE_T* create_html_attribute_with_ruby_literal(
  const char* name_string,
  const char* ruby_content,
  position_T start_position,
  position_T end_position,
  hb_allocator_T* allocator
);

AST_HTML_ATTRIBUTE_NODE_T* create_html_attribute_with_interpolated_value(
  const char* name_string,
  pm_interpolated_string_node_t* interpolated_node,
  position_T start_position,
  position_T end_position,
  hb_allocator_T* allocator
);

hb_array_T* prepend_attribute(hb_array_T* attributes, AST_NODE_T* attribute, hb_allocator_T* allocator);

AST_HTML_ATTRIBUTE_NODE_T* create_href_attribute(
  const char* href,
  bool is_ruby_expression,
  position_T start_position,
  position_T end_position,
  hb_allocator_T* allocator
);

void append_body_content_node(
  hb_array_T* body,
  const char* content,
  bool is_ruby_expression,
  position_T start,
  position_T end,
  hb_allocator_T* allocator
);

#endif
