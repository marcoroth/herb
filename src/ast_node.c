#include "include/ast_node.h"
#include "include/ast_nodes.h"
#include "include/errors.h"
#include "include/token.h"
#include "include/util.h"

#include <prism.h>
#include <stdio.h>
#include <stdlib.h>

size_t ast_node_sizeof(void) {
  return sizeof(struct AST_NODE_STRUCT);
}

void ast_node_init(arena_allocator_T* allocator, AST_NODE_T* node, const ast_node_type_T type, position_T start, position_T end, array_T* errors) {
  if (!node) { return; }

  node->type = type;
  node->location.start = start;
  node->location.end = end;

  if (errors == NULL) {
    node->errors = array_init(allocator, 8);
  } else {
    node->errors = errors;
  }
}

AST_LITERAL_NODE_T* ast_literal_node_init_from_token(arena_allocator_T* allocator, const token_T* token) {
  AST_LITERAL_NODE_T* literal = arena_alloc(allocator, sizeof(AST_LITERAL_NODE_T));

  ast_node_init(allocator, &literal->base, AST_LITERAL_NODE, token->location.start, token->location.end, NULL);

  literal->content = herb_strdup(allocator, token->value);

  return literal;
}

ast_node_type_T ast_node_type(const AST_NODE_T* node) {
  return node->type;
}

size_t ast_node_errors_count(const AST_NODE_T* node) {
  return array_size(node->errors);
}

array_T* ast_node_errors(const AST_NODE_T* node) {
  return node->errors;
}

void ast_node_append_error(arena_allocator_T *allocator, const AST_NODE_T* node, ERROR_T* error) {
  array_append(allocator, node->errors, error);
}

void ast_node_set_start(AST_NODE_T* node, position_T position) {
  node->location.start = position;
}

void ast_node_set_end(AST_NODE_T* node, position_T position) {
  node->location.end = position;
}

void ast_node_set_start_from_token(AST_NODE_T* node, const token_T* token) {
  ast_node_set_start(node, token->location.start);
}

void ast_node_set_end_from_token(AST_NODE_T* node, const token_T* token) {
  ast_node_set_end(node, token->location.end);
}

void ast_node_set_positions_from_token(AST_NODE_T* node, const token_T* token) {
  ast_node_set_start_from_token(node, token);
  ast_node_set_end_from_token(node, token);
}

bool ast_node_is(const AST_NODE_T* node, const ast_node_type_T type) {
  return node->type == type;
}
