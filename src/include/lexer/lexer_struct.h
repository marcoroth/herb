#ifndef HERB_LEXER_STRUCT_H
#define HERB_LEXER_STRUCT_H

#include "../lib/hb_allocator.h"
#include "../lib/hb_string.h"

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>

typedef enum {
  STATE_DATA,
  STATE_NUNJUCKS_OUTPUT,
  STATE_NUNJUCKS_TAG,
  STATE_NUNJUCKS_COMMENT,
  STATE_NUNJUCKS_CLOSE,
  STATE_NUNJUCKS_RAW,
} lexer_state_T;

typedef enum {
  NUNJUCKS_DELIMITER_NONE,
  NUNJUCKS_DELIMITER_OUTPUT,
  NUNJUCKS_DELIMITER_TAG,
  NUNJUCKS_DELIMITER_COMMENT,
} nunjucks_delimiter_T;

typedef enum {
  NUNJUCKS_RAW_NONE,
  NUNJUCKS_RAW_RAW,
  NUNJUCKS_RAW_VERBATIM,
} nunjucks_raw_kind_T;

typedef struct LEXER_STRUCT {
  hb_allocator_T* allocator;
  hb_string_T source;

  uint32_t current_line;
  uint32_t current_column;
  uint32_t current_position;

  uint32_t previous_line;
  uint32_t previous_column;
  uint32_t previous_position;

  char current_character;
  lexer_state_T state;
  nunjucks_delimiter_T pending_close;
  uint8_t pending_close_length;
  nunjucks_raw_kind_T pending_raw;
  nunjucks_raw_kind_T open_raw;
  uint32_t stall_counter;
  uint32_t last_position;
  bool stalled;
} lexer_T;

#endif
