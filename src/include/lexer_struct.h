#ifndef ERBX_LEXER_STRUCT_H
#define ERBX_LEXER_STRUCT_H

#include <stdlib.h>

typedef enum {
  STATE_DATA,
  STATE_HTML_TAG_OPEN,
  STATE_HTML_TAG_NAME,
  STATE_HTML_TAG_CLOSE,
  STATE_HTML_ATTRIBUTES,
  STATE_HTML_ATTRIBUTE_NAME,
  STATE_HTML_ATTRIBUTE_EQUALS,
  STATE_HTML_ATTRIBUTE_VALUE,
  STATE_HTML_COMMENT_OPEN,
  STATE_HTML_COMMENT_CLOSE,
  STATE_ERB_OPEN,
} lexer_state_T;

typedef struct LEXER_STRUCT {
  char* source;
  size_t source_length;
  char current_character;
  unsigned int current_position;
  unsigned int current_line;
  unsigned int current_column;
  lexer_state_T state;
} lexer_T;

#endif
