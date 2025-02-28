#ifndef ERBX_LEXER_STRUCT_H
#define ERBX_LEXER_STRUCT_H

#include <stdlib.h>

typedef enum {
  STATE_DATA,
  STATE_ERB_CONTENT,
  STATE_ERB_CLOSE,
} lexer_state_T;

typedef struct LEXER_STRUCT {
  const char* source;
  size_t source_length;
  size_t current_position;
  size_t current_line;
  size_t current_column;
  char current_character;
  lexer_state_T state;
} lexer_T;

#endif
