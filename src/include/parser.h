#ifndef ERBX_PARSER_H
#define ERBX_PARSER_H

#include "array.h"
#include "ast_node.h"
#include "lexer.h"

typedef struct PARSER_STRUCT {
  lexer_T* lexer;
  token_T* current_token;
  array_T* open_tags_stack;
} parser_T;

parser_T* parser_init(lexer_T* lexer);

AST_DOCUMENT_NODE_T* parser_parse(parser_T* parser);

size_t parser_sizeof(void);

void parser_free(parser_T* parser);

#endif
