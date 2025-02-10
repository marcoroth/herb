#include "include/parser.h"
#include "include/ast.h"
#include "include/token.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

size_t parser_sizeof(void) {
  return sizeof(struct PARSER_STRUCT);
}

parser_T* parser_init(lexer_T* lexer) {
  parser_T* parser = calloc(1, parser_sizeof());
  parser->lexer = lexer;
  parser->token = lexer_next_token(lexer);

  return parser;
}

token_T* parser_consume(parser_T* parser, int type) {
  if (parser->token->type != type) {
    printf("[Parser]: Unexpected token: '%s', was expected: '%s'\n",
        token_to_string(parser->token),
        token_type_string(type));
    exit(1);
  }

  parser->token = lexer_next_token(parser->lexer);

  return parser->token;
}

AST_T* parser_parse(parser_T* parser) {
  switch (parser->token->type) {
    default: {
    }
  }

  return ast_init(AST_NOOP);
}
