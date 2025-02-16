#include "include/parser.h"
#include "include/ast.h"
#include "include/token.h"

#include <stdio.h>
#include <stdlib.h>

size_t parser_sizeof(void) {
  return sizeof(struct PARSER_STRUCT);
}

parser_T* parser_init(lexer_T* lexer) {
  parser_T* parser = calloc(1, parser_sizeof());
  parser->lexer = lexer;
  parser->current_token = lexer_next_token(lexer);

  return parser;
}

token_T* parser_consume(parser_T* parser, token_type_T type) {
  if (parser->current_token->type != type) {
    printf("[Parser]: Unexpected token: '%s', expected: '%s'\n",
        token_to_string(parser->current_token),
        token_type_to_string(type));
    exit(1);
  }

  parser->current_token = lexer_next_token(parser->lexer);

  return parser->current_token;
}

AST_T* parser_parse(parser_T* parser) {
  switch (parser->current_token->type) {
    default: {
    }
  }

  return ast_init(AST_NOOP);
}
