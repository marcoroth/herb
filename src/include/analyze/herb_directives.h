#ifndef HERB_ANALYZE_HERB_DIRECTIVES_H
#define HERB_ANALYZE_HERB_DIRECTIVES_H

#include "../ast/ast_nodes.h"
#include "analyze.h"

#include <stdbool.h>

bool transform_herb_directive_nodes(const AST_NODE_T* node, void* data);

#endif
