#include "include/ast_node.h"
#include "include/ast_nodes.h"
#include "include/errors.h"
#include "include/position.h"
#include "include/util.h"
#include "include/visitor.h"

#include <prism.h>
#include <stdio.h>
#include <stdlib.h>

size_t ast_node_sizeof(void) {
  return sizeof(struct AST_NODE_STRUCT);
}

void ast_node_init(AST_NODE_T* node, const ast_node_type_T type, position_T start, position_T end, hb_array_T* errors) {
  if (!node) { return; }

  node->type = type;
  node->location.start = start;
  node->location.end = end;

  if (errors == NULL) {
    node->errors = hb_array_init(8);
  } else {
    node->errors = errors;
  }
}

AST_LITERAL_NODE_T* ast_literal_node_init_from_token(const token_T* token) {
  AST_LITERAL_NODE_T* literal = malloc(sizeof(AST_LITERAL_NODE_T));

  if (!literal) { return NULL; }

  ast_node_init(&literal->base, AST_LITERAL_NODE, token->location.start, token->location.end, NULL);

  literal->content = herb_strdup(token->value);

  return literal;
}

ast_node_type_T ast_node_type(const AST_NODE_T* node) {
  return node->type;
}

size_t ast_node_errors_count(const AST_NODE_T* node) {
  return hb_array_size(node->errors);
}

hb_array_T* ast_node_errors(const AST_NODE_T* node) {
  return node->errors;
}

void ast_node_append_error(const AST_NODE_T* node, ERROR_T* error) {
  hb_array_append(node->errors, error);
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

typedef struct {
  position_T position;
  AST_NODE_T* found_node;
} find_erb_at_position_context_T;

static bool find_erb_at_position_visitor(const AST_NODE_T* node, void* data) {
  find_erb_at_position_context_T* context = (find_erb_at_position_context_T*) data;

  if (node->type == AST_ERB_CONTENT_NODE) {
    if (position_is_within_range(context->position, node->location.start, node->location.end)) {
      context->found_node = (AST_NODE_T*) node;
      return false;
    }
  }

  return true;
}

AST_NODE_T* find_erb_content_at_offset(AST_DOCUMENT_NODE_T* document, const char* source, size_t offset) {
  position_T position = position_from_source_with_offset(source, offset);
  find_erb_at_position_context_T context = { .position = position, .found_node = NULL };

  herb_visit_node((AST_NODE_T*) document, find_erb_at_position_visitor, &context);

  return context.found_node;
}
