#ifndef HERB_ANALYZE_POSTFIX_CONDITIONALS_H
#define HERB_ANALYZE_POSTFIX_CONDITIONALS_H

#include "../ast/ast_nodes.h"
#include "analyze.h"

bool transform_conditional_nodes(const AST_NODE_T* node, void* data);

#endif
