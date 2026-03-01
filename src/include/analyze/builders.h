#ifndef HERB_ANALYZE_BUILDERS_H
#define HERB_ANALYZE_BUILDERS_H

#include "analyze.h"
#include "../ast_nodes.h"
#include "../location.h"
#include "../position.h"

position_T erb_content_end_position(const AST_ERB_CONTENT_NODE_T* erb_node);

location_T* compute_then_keyword(AST_ERB_CONTENT_NODE_T* erb_node, control_type_t control_type);

AST_NODE_T* create_control_node(
  AST_ERB_CONTENT_NODE_T* erb_node,
  hb_array_T* children,
  AST_NODE_T* subsequent,
  AST_ERB_END_NODE_T* end_node,
  control_type_t control_type
);

#endif
