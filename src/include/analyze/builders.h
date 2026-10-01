#ifndef HERB_ANALYZE_BUILDERS_H
#define HERB_ANALYZE_BUILDERS_H

#include "../ast/ast_nodes.h"
#include "../lib/hb_allocator.h"
#include "../location/location.h"
#include "../location/position.h"
#include "analyze.h"

position_T erb_tag_start_position(const token_T* tag_opening, const token_T* content, location_T location);
position_T erb_tag_end_position(
  const token_T* tag_closing,
  const token_T* content,
  const token_T* tag_opening,
  location_T location
);

position_T erb_content_start_position(const AST_ERB_CONTENT_NODE_T* erb_node);
position_T erb_content_end_position(const AST_ERB_CONTENT_NODE_T* erb_node);

location_T* compute_then_keyword_for_content(
  token_T* content,
  analyzed_ruby_T* analyzed_ruby,
  control_type_t control_type,
  hb_allocator_T* allocator
);

location_T* compute_then_keyword(
  AST_ERB_CONTENT_NODE_T* erb_node,
  control_type_t control_type,
  hb_allocator_T* allocator
);

AST_NODE_T* create_control_node(
  AST_ERB_CONTENT_NODE_T* erb_node,
  hb_array_T* children,
  AST_NODE_T* subsequent,
  AST_ERB_END_NODE_T* end_node,
  control_type_t control_type,
  hb_allocator_T* allocator
);

#endif
