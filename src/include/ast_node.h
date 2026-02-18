#ifndef HERB_AST_H
#define HERB_AST_H

#include "ast_nodes.h"
#include "errors.h"
#include "position.h"
#include "token_struct.h"
#include "util/hb_arena.h"

void ast_node_init(AST_NODE_T* node, ast_node_type_T type, position_T start, position_T end, hb_array_T* errors);
void ast_node_free(AST_NODE_T* node);

AST_LITERAL_NODE_T* ast_literal_node_init_from_token(const token_T* token, hb_arena_T* arena);

size_t ast_node_sizeof(void);
size_t ast_node_child_count(AST_NODE_T* node);

ast_node_type_T ast_node_type(const AST_NODE_T* node);

char* ast_node_name(AST_NODE_T* node);

void ast_node_set_start(AST_NODE_T* node, position_T position);
void ast_node_set_end(AST_NODE_T* node, position_T position);

size_t ast_node_errors_count(const AST_NODE_T* node);
hb_array_T* ast_node_errors(const AST_NODE_T* node);
void ast_node_append_error(const AST_NODE_T* node, ERROR_T* error);

void ast_node_set_start_from_token(AST_NODE_T* node, const token_T* token);
void ast_node_set_end_from_token(AST_NODE_T* node, const token_T* token);

void ast_node_set_positions_from_token(AST_NODE_T* node, const token_T* token);

bool ast_node_is(const AST_NODE_T* node, ast_node_type_T type);

AST_NODE_T* find_erb_content_at_offset(AST_DOCUMENT_NODE_T* document, const char* source, size_t offset);

#endif
