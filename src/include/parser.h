#ifndef ERBX_PARSER_H
#define ERBX_PARSER_H

#include "ast.h"
#include "lexer.h"

typedef struct PARSER_STRUCT {
  lexer_T* lexer;
  token_T* current_token;
} parser_T;

parser_T* parser_init(lexer_T* lexer);
token_T* parser_consume(parser_T* parser, token_type_T type);
AST_T* parser_parse(parser_T* parser);

size_t parser_sizeof(void);

#endif
