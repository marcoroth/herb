#include "include/ast_node.h"
#include "include/ast_nodes.h"
#include "include/errors.h"
#include "include/token.h"
#include "include/util.h"

#include <stdio.h>
#include <stdlib.h>

size_t ast_node_sizeof(void) {
  return sizeof(struct AST_NODE_STRUCT);
}

void ast_node_init(AST_NODE_T* node, const ast_node_type_T type, location_T* start, location_T* end, array_T* errors) {
  if (!node) { return; }

  node->type = type;
  node->start = location_copy(start);
  node->end = location_copy(end);

  if (errors == NULL) {
    node->errors = array_init(1);
  } else {
    node->errors = errors;
  }
}

AST_LITERAL_NODE_T* ast_literal_node_init_from_token(const token_T* token) {
  AST_LITERAL_NODE_T* literal = malloc(sizeof(AST_LITERAL_NODE_T));

  ast_node_init(&literal->base, AST_LITERAL_NODE, token->start, token->end, NULL);

  literal->content = erbx_strdup(token->value);

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

void ast_node_append_error(const AST_NODE_T* node, ERROR_T* error) {
  array_append(node->errors, error);
}

void ast_node_set_start(AST_NODE_T* node, location_T* location) {
  if (node->start != NULL) { location_free(node->start); }

  node->start = location_copy(location);
}

void ast_node_set_end(AST_NODE_T* node, location_T* location) {
  if (node->end != NULL) { location_free(node->end); }

  node->end = location_copy(location);
}

void ast_node_set_start_from_token(AST_NODE_T* node, const token_T* token) {
  ast_node_set_start(node, token->start);
}

void ast_node_set_end_from_token(AST_NODE_T* node, const token_T* token) {
  ast_node_set_end(node, token->end);
}

void ast_node_set_locations_from_token(AST_NODE_T* node, const token_T* token) {
  ast_node_set_start_from_token(node, token);
  ast_node_set_end_from_token(node, token);
}

bool ast_node_is(const AST_NODE_T* node, const ast_node_type_T type) {
  return node->type == type;
}
