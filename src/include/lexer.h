#ifndef ERBX_LEXER_H
#define ERBX_LEXER_H

#include "token.h"
#include <stdio.h>

typedef struct LEXER_STRUCT {
  char* source;
  size_t source_length;
  char current_character;
  unsigned int current_position;
  enum {
    STATE_NONE,
    STATE_SINGLE_QUOTE,
    STATE_DOUBLE_QUOTE,
    STATE_START_TAG_START,
    STATE_END_TAG_START,
    STATE_END_TAG_END,
    STATE_TAG_ATTRIBUTES,
    STATE_ATTRIBUTE_START,
    STATE_ATTRIBUTE_VALUE_START,
    STATE_ATTRIBUTE_VALUE,
    STATE_ATTRIBUTE_VALUE_END,
    STATE_ELEMENT_CHILDREN,
    STATE_ERB_OPEN,
  } state;
} lexer_T;

lexer_T* lexer_init(char* src);

void lexer_skip_whitespace(lexer_T* lexer);
void lexer_advance(lexer_T* lexer);
char lexer_peek(lexer_T* lexer, int offset);
char lexer_backtrack(lexer_T* lexer, int offset);

token_T* lexer_advance_current(lexer_T* lexer, int type);
token_T* lexer_advance_with(lexer_T* lexer, token_T* token);
token_T* lexer_next_token(lexer_T* lexer);
token_T* lexer_parse_attribute_name(lexer_T* lexer);
token_T* lexer_parse_attribute_value(lexer_T* lexer);
token_T* lexer_parse_double_quoted_id(lexer_T* lexer);
token_T* lexer_parse_newline(lexer_T* lexer);
token_T* lexer_parse_single_quoted_id(lexer_T* lexer);
token_T* lexer_parse_tag_name(lexer_T* lexer);
token_T* lexer_parse_whitespace(lexer_T* lexer);

#endif
