#ifndef HERB_LEXER_PEEK_HELPERS_H
#define HERB_LEXER_PEEK_HELPERS_H

#include "lexer_struct.h"
#include "macros.h"
#include "token_struct.h"
#include "util/hb_string.h"

#include <ctype.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

typedef struct {
  uint32_t position;
  uint32_t line;
  uint32_t column;
  uint32_t previous_position;
  uint32_t previous_line;
  uint32_t previous_column;
  char current_character;
  lexer_state_T state;
} lexer_state_snapshot_T;

bool lexer_peek_for_doctype(const lexer_T* lexer, uint32_t offset);
bool lexer_peek_for_xml_declaration(const lexer_T* lexer, uint32_t offset);
bool lexer_peek_for_cdata_start(const lexer_T* lexer, uint32_t offset);
bool lexer_peek_for_cdata_end(const lexer_T* lexer, uint32_t offset);
bool lexer_peek_for_html_comment_start(const lexer_T* lexer, uint32_t offset);
bool lexer_peek_for_token_type_after_whitespace(lexer_T* lexer, token_type_T token_type);
bool lexer_peek_for_close_tag_start(const lexer_T* lexer, uint32_t offset);

static inline char lexer_peek(const lexer_T* lexer, uint32_t offset) {
  return lexer->source.data[MIN(lexer->current_position + offset, lexer->source.length)];
}

static inline char lexer_backtrack(const lexer_T* lexer, uint32_t offset) {
  return lexer->source.data[MAX(lexer->current_position - offset, 0)];
}

static inline bool lexer_peek_for_html_comment_end(const lexer_T* lexer, uint32_t offset) {
  uint32_t position = lexer->current_position + offset;

  return position + 2 < lexer->source.length && lexer->source.data[position] == '-'
      && lexer->source.data[position + 1] == '-' && lexer->source.data[position + 2] == '>';
}

static inline bool lexer_peek_for_html_comment_invalid_end(const lexer_T* lexer, uint32_t offset) {
  uint32_t position = lexer->current_position + offset;

  return position + 3 < lexer->source.length && lexer->source.data[position] == '-'
      && lexer->source.data[position + 1] == '-' && lexer->source.data[position + 2] == '!'
      && lexer->source.data[position + 3] == '>';
}

static inline bool lexer_peek_erb_start(const lexer_T* lexer, uint32_t offset) {
  uint32_t position = lexer->current_position + offset;

  return position + 1 < lexer->source.length && lexer->source.data[position] == '<'
      && lexer->source.data[position + 1] == '%';
}

static inline bool lexer_peek_erb_close_tag(const lexer_T* lexer, uint32_t offset) {
  uint32_t position = lexer->current_position + offset;

  return position + 1 < lexer->source.length && lexer->source.data[position] == '%'
      && lexer->source.data[position + 1] == '>';
}

static inline bool lexer_peek_erb_dash_close_tag(const lexer_T* lexer, uint32_t offset) {
  uint32_t position = lexer->current_position + offset;

  return position + 2 < lexer->source.length && lexer->source.data[position] == '-'
      && lexer->source.data[position + 1] == '%' && lexer->source.data[position + 2] == '>';
}

static inline bool lexer_peek_erb_percent_close_tag(const lexer_T* lexer, uint32_t offset) {
  uint32_t position = lexer->current_position + offset;

  return position + 2 < lexer->source.length && lexer->source.data[position] == '%'
      && lexer->source.data[position + 1] == '%' && lexer->source.data[position + 2] == '>';
}

static inline bool lexer_peek_erb_equals_close_tag(const lexer_T* lexer, uint32_t offset) {
  uint32_t position = lexer->current_position + offset;

  return position + 2 < lexer->source.length && lexer->source.data[position] == '='
      && lexer->source.data[position + 1] == '%' && lexer->source.data[position + 2] == '>';
}

static inline bool lexer_peek_erb_end(const lexer_T* lexer, uint32_t offset) {
  return lexer_peek_erb_close_tag(lexer, offset) || lexer_peek_erb_dash_close_tag(lexer, offset)
      || lexer_peek_erb_percent_close_tag(lexer, offset) || lexer_peek_erb_equals_close_tag(lexer, offset);
}

static inline lexer_state_snapshot_T lexer_save_state(lexer_T* lexer) {
  lexer_state_snapshot_T snapshot = { .position = lexer->current_position,
                                      .line = lexer->current_line,
                                      .column = lexer->current_column,
                                      .previous_position = lexer->previous_position,
                                      .previous_line = lexer->previous_line,
                                      .previous_column = lexer->previous_column,
                                      .current_character = lexer->current_character,
                                      .state = lexer->state };
  return snapshot;
}

static inline void lexer_restore_state(lexer_T* lexer, lexer_state_snapshot_T snapshot) {
  lexer->current_position = snapshot.position;
  lexer->current_line = snapshot.line;
  lexer->current_column = snapshot.column;
  lexer->previous_position = snapshot.previous_position;
  lexer->previous_line = snapshot.previous_line;
  lexer->previous_column = snapshot.previous_column;
  lexer->current_character = snapshot.current_character;
  lexer->state = snapshot.state;
}

#endif
