#ifndef ERBX_LEXER_STRUCT_H
#define ERBX_LEXER_STRUCT_H

#include <stdlib.h>

typedef enum {
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
  STATE_ELEMENT_CHILDREN
} lexer_state_t;

typedef enum { STATE_ERB_NONE, STATE_ERB_OPEN } lexer_erb_state_t;

typedef struct LEXER_STRUCT {
  char* source;
  size_t source_length;
  char current_character;
  unsigned int current_position;
  unsigned int current_line;
  unsigned int current_column;
  lexer_state_t state;
  lexer_erb_state_t erb_state;
} lexer_T;

#endif
