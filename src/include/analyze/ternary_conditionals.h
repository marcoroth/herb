#ifndef HERB_ANALYZE_TERNARY_CONDITIONALS_H
#define HERB_ANALYZE_TERNARY_CONDITIONALS_H

#include "../ast/ast_nodes.h"
#include "analyze.h"

AST_NODE_T* transform_ternary_expression(
  AST_ERB_CONTENT_NODE_T* erb_node,
  pm_if_node_t* if_node,
  hb_allocator_T* allocator
);

bool transform_ternary_conditional_nodes(const AST_NODE_T* node, void* data);

#endif
