#ifndef HERB_ANALYZE_STRICT_LOCALS_H
#define HERB_ANALYZE_STRICT_LOCALS_H

#include "../ast_nodes.h"
#include "analyze.h"

#include <stdbool.h>

bool transform_strict_locals_nodes(const AST_NODE_T* node, void* data);

#endif
