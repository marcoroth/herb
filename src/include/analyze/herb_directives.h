#ifndef HERB_ANALYZE_HERB_DIRECTIVES_H
#define HERB_ANALYZE_HERB_DIRECTIVES_H

#include "../ast/ast_nodes.h"
#include "../lib/hb_string.h"
#include "analyze.h"

#include <prism.h>
#include <stdbool.h>

bool transform_herb_directive_nodes(const AST_NODE_T* node, void* data);
hb_string_T herb_directive_kind_for_prism_node(const pm_node_t* node);

#endif
