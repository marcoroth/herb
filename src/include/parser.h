#ifndef ERBX_PARSER_H
#define ERBX_PARSER_H

#include "lexer.h"
#include "ast.h"

typedef struct PARSER_STRUCT {
  lexer_T* lexer;
  token_T* token;
} parser_T;

parser_T* init_parser(lexer_T* lexer);
token_T* parser_consome(parser_T* parser, int type);
AST_T* parser_parse(parser_T* parser);

#endif
