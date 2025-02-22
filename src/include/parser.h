#ifndef ERBX_PARSER_H
#define ERBX_PARSER_H

#include "ast_node.h"
#include "lexer.h"

typedef struct PARSER_STRUCT {
  lexer_T* lexer;
  token_T* current_token;
} parser_T;

parser_T* parser_init(lexer_T* lexer);
token_T* parser_consume(parser_T* parser, token_type_T type, AST_NODE_T* node);
AST_HTML_DOCUMENT_NODE_T* parser_parse(parser_T* parser);

size_t parser_sizeof(void);

#endif
