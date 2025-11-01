#ifndef HERB_CSS_NODE_HELPERS_H
#define HERB_CSS_NODE_HELPERS_H

#include "ast_nodes.h"
#include "position.h"

#ifdef __cplusplus
extern "C" {
#endif

AST_CSS_STYLE_NODE_T* create_css_style_node(
  const char* css_content,
  position_T start_position,
  position_T end_position
);

#ifdef __cplusplus
}
#endif

#endif
