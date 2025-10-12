#ifndef HERB_PARSER_H
#define HERB_PARSER_H

#include "array.h"
#include "ast_node.h"
#include "lexer.h"

typedef enum {
  FOREIGN_CONTENT_UNKNOWN = 0,
  FOREIGN_CONTENT_SCRIPT,
  FOREIGN_CONTENT_STYLE,
  // FOREIGN_CONTENT_RUBY,
  // FOREIGN_CONTENT_TEMPLATE
} foreign_content_type_T;

typedef enum { PARSER_STATE_DATA, PARSER_STATE_FOREIGN_CONTENT } parser_state_T;

typedef struct PARSER_OPTIONS_STRUCT {
  bool track_whitespace;
} parser_options_T;

extern const parser_options_T HERB_DEFAULT_PARSER_OPTIONS;

typedef struct PARSER_STRUCT {
  lexer_T* lexer;
  token_T* current_token;
  array_T* open_tags_stack;
  parser_state_T state;
  foreign_content_type_T foreign_content_type;
  parser_options_T options;
} parser_T;

void herb_parser_init(parser_T* parser, lexer_T* lexer, parser_options_T options);

AST_DOCUMENT_NODE_T* herb_parser_parse(parser_T* parser);

size_t parser_sizeof(void);

void parser_free(parser_T* parser);

#endif
