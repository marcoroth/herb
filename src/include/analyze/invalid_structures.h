#ifndef HERB_ANALYZE_INVALID_STRUCTURES_H
#define HERB_ANALYZE_INVALID_STRUCTURES_H

#include "analyze.h"
#include "../ast_node.h"

#include <stdbool.h>

bool detect_invalid_erb_structures(const AST_NODE_T* node, void* data);

#endif
