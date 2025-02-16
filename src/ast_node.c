#include "include/ast_node.h"

#include <stdlib.h>

size_t ast_node_sizeof(void) {
  return sizeof(struct AST_NODE_STRUCT);
}

AST_NODE_T* ast_node_init(ast_node_type_T type) {
  AST_NODE_T* node = calloc(1, ast_node_sizeof());

  node->type = type;
  node->children = array_init(ast_node_sizeof());

  return node;
}

char* ast_node_name(AST_NODE_T* node) {
  return node->name;
}

ast_node_type_T ast_node_type(AST_NODE_T* node) {
  return node->type;
}

size_t ast_node_children_count(AST_NODE_T* node) {
  return array_size(node->children);
}

char* ast_node_type_to_string(AST_NODE_T* node) {
  switch (node->type) {
    case AST_NOOP: return "AST_NOOP_NODE";

    // TODO: remove default branch so the compiler forces us to define all values
    default: return "Unsupported node type";
  }
}
