#ifndef HERB_ANALYZE_EACH_NODES_H
#define HERB_ANALYZE_EACH_NODES_H

#include "../ast/ast_nodes.h"
#include "analyze.h"

#include <stdbool.h>

bool transform_each_nodes(const AST_NODE_T* node, void* data);

#endif
