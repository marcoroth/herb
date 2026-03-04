#ifndef HERB_ANALYZE_CONTROL_TYPE_H
#define HERB_ANALYZE_CONTROL_TYPE_H

#include "analyze.h"
#include "../ast_nodes.h"

#include <stdbool.h>

control_type_t detect_control_type(AST_ERB_CONTENT_NODE_T* erb_node);
bool is_subsequent_type(control_type_t parent_type, control_type_t child_type);
bool is_terminator_type(control_type_t parent_type, control_type_t child_type);
bool is_compound_control_type(control_type_t type);

#endif
