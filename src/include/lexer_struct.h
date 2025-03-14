#ifndef HERB_LEXER_STRUCT_H
#define HERB_LEXER_STRUCT_H

#include <stdbool.h>
#include <stdlib.h>

typedef enum {
  STATE_DATA,
  STATE_ERB_CONTENT,
  STATE_ERB_CLOSE,
} lexer_state_T;

typedef struct LEXER_STRUCT {
  const char* source;
  size_t source_length;

  size_t current_line;
  size_t current_column;
  size_t current_position;

  size_t previous_line;
  size_t previous_column;
  size_t previous_position;

  char current_character;
  lexer_state_T state;
  size_t stall_counter;
  size_t last_position;
  bool stalled;
} lexer_T;

#endif
