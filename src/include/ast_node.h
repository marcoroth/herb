#ifndef ERBX_AST_H
#define ERBX_AST_H

#include "ast_nodes.h"
#include "location.h"
#include "token_struct.h"

void ast_node_init(AST_NODE_T* node, ast_node_type_T type, location_T* start, location_T* end, array_T* errors);
void ast_node_free(AST_NODE_T* node);

AST_LITERAL_NODE_T* ast_literal_node_init_from_token(const token_T* token);

char* unexpected_token_message(const char* message, const char* expected, const char* got);
AST_UNEXPECTED_TOKEN_NODE_T* ast_unexpected_token_node_init_from_token(const token_T* token, const char* expected);
AST_UNEXPECTED_TOKEN_NODE_T* ast_unexpected_token_node_init_from_raw_message(
  location_T* start, location_T* end, const char* message, const char* expected, const char* actual
);

size_t ast_node_sizeof(void);
size_t ast_node_child_count(AST_NODE_T* node);

ast_node_type_T ast_node_type(const AST_NODE_T* node);

char* ast_node_name(AST_NODE_T* node);

void ast_node_set_start(AST_NODE_T* node, location_T* location);
void ast_node_set_end(AST_NODE_T* node, location_T* location);

size_t ast_node_errors_count(const AST_NODE_T* node);
array_T* ast_node_errors(const AST_NODE_T* node);
void ast_node_append_error(const AST_NODE_T* node, AST_NODE_T* error);

void ast_node_set_start_from_token(AST_NODE_T* node, const token_T* token);
void ast_node_set_end_from_token(AST_NODE_T* node, const token_T* token);

void ast_node_set_locations_from_token(AST_NODE_T* node, const token_T* token);

#endif
