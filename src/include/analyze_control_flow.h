#ifndef HERB_ANALYZE_CONTROL_FLOW_H
#define HERB_ANALYZE_CONTROL_FLOW_H

#include "analyze.h"
#include "array.h"
#include "ast_nodes.h"
#include "position.h"
#include <prism.h>
#include <stdbool.h>

control_type_t detect_control_type(AST_ERB_CONTENT_NODE_T* erb_node);

bool is_subsequent_type(control_type_t parent_type, control_type_t child_type);
bool is_terminator_type(control_type_t parent_type, control_type_t child_type);

AST_NODE_T* create_control_node(
  AST_ERB_CONTENT_NODE_T* erb_node, array_T* children, AST_NODE_T* subsequent, AST_ERB_END_NODE_T* end_node,
  control_type_t control_type
);

size_t process_control_structure(
  AST_NODE_T* node, array_T* array, size_t index, array_T* output_array, analyze_ruby_context_T* context,
  control_type_t initial_type
);

array_T* rewrite_node_array(AST_NODE_T* node, array_T* array, analyze_ruby_context_T* context);

#endif
