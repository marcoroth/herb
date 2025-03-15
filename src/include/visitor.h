#ifndef HERB_VISITOR_H
#define HERB_VISITOR_H

#include "array.h"
#include "ast_node.h"
#include "ast_nodes.h"

void herb_visit_node(const AST_NODE_T* node, bool (*visitor)(const AST_NODE_T*, void*), void* data);
void herb_visit_child_nodes(const AST_NODE_T* node, bool (*visitor)(const AST_NODE_T* node, void* data), void* data);

#endif
