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
