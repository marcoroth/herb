#include "include/token.h"
#include "include/lexer.h"
#include "include/location.h"
#include "include/macros.h"
#include "include/token_struct.h"
#include "include/util.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

size_t token_sizeof(void) {
  return sizeof(struct TOKEN_STRUCT);
}

token_T* token_init(char* value, int type, lexer_T* lexer) {
  token_T* token = calloc(1, token_sizeof());
  token->value = value;
  token->type = type;

  token->range = range_init(lexer->current_position - strlen(value), lexer->current_position);

  int start_line = lexer->current_line - count_newlines(value);
  int start_column = lexer->current_column - strlen(value); // TODO: fix start_column calculation if
                                                            // value contains newlines
  int end_line = lexer->current_line;
  int end_column = lexer->current_column;

  token->start = location_init(start_line, start_column);
  token->end = location_init(end_line, end_column);

  return token;
}

const char* token_type_string(int type) {
  switch (type) {
    case TOKEN_ATTRIBUTE_NAME: return "TOKEN_ATTRIBUTE_NAME";
    case TOKEN_ATTRIBUTE_VALUE: return "TOKEN_ATTRIBUTE_VALUE";
    case TOKEN_DOUBLE_QUOTE: return "TOKEN_DOUBLE_QUOTE";
    case TOKEN_END_TAG_END: return "TOKEN_END_TAG_END";
    case TOKEN_END_TAG_START: return "TOKEN_END_TAG_START";
    case TOKEN_EOF: return "TOKEN_EOF";
    case TOKEN_EQUALS: return "TOKEN_EQUALS";
    case TOKEN_ID: return "TOKEN_ID";
    case TOKEN_NEWLINE: return "TOKEN_NEWLINE";
    case TOKEN_SINGLE_QUOTE: return "TOKEN_SINGLE_QUOTE";
    case TOKEN_SPACE: return "TOKEN_SPACE";
    case TOKEN_START_TAG_END_VOID: return "TOKEN_START_TAG_END_VOID";
    case TOKEN_START_TAG_END: return "TOKEN_START_TAG_END";
    case TOKEN_START_TAG_START: return "TOKEN_START_TAG_START";
    case TOKEN_TAG_END: return "TOKEN_TAG_END";
    case TOKEN_TAG_NAME: return "TOKEN_TAG_NAME";
    case TOKEN_TEXT_CONTENT: return "TOKEN_TEXT_CONTENT";
    case TOKEN_WHITESPACE: return "TOKEN_WHITESPACE";

    default: {
      printf("Unknown token type: %d\n", type);
      exit(1);
    }
  }

  return "don't know token";
}

char* token_to_string(token_T* token) {
  const char* type_string = token_type_string(token->type);
  const char* template = "#<Token type=%s value='%s' range=[%d, %d] start=%d:%d end=%d:%d>";

  char* string = calloc(strlen(type_string) + strlen(template) + 8, sizeof(char));

  char* escaped = escape_newlines(token->value);

  sprintf(string, template, type_string, escaped, token->range->start, token->range->end, token->start->line,
          token->start->column, token->end->line, token->end->column);

  free(escaped);

  return string;
}

char* token_value(token_T* token) {
  return token->value;
}

int token_type(token_T* token) {
  return token->type;
}
