#ifndef HERB_ANALYZE_RENDER_NODES_H
#define HERB_ANALYZE_RENDER_NODES_H

#include "../ast_nodes.h"
#include "analyze.h"

#include <stdbool.h>

bool transform_render_nodes(const AST_NODE_T* node, void* data);

#endif
