#ifndef HERB_VISITOR_H
#define HERB_VISITOR_H

#include "array.h"
#include "ast_node.h"
#include "memory_arena.h"

void herb_visit_node(arena_allocator_T* allocator, const AST_NODE_T* node, bool (*visitor)(arena_allocator_T* allocator, const AST_NODE_T*, void*), void* data);
void herb_visit_child_nodes(arena_allocator_T* allocator, const AST_NODE_T* node, bool (*visitor)(arena_allocator_T* allocator, const AST_NODE_T* node, void* data), void* data);

#endif
