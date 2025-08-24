#ifndef HERB_LEXER_PEEK_HELPERS_H
#define HERB_LEXER_PEEK_HELPERS_H

#include "lexer_struct.h"
#include "token_struct.h"

#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>

typedef struct {
  size_t position;
  size_t line;
  size_t column;
  size_t previous_position;
  size_t previous_line;
  size_t previous_column;
  char current_character;
  lexer_state_T state;
} lexer_state_snapshot_T;

char lexer_peek(const lexer_T* lexer, int offset);
bool lexer_peek_for_doctype(const lexer_T* lexer, int offset);
bool lexer_peek_for_xml_declaration(const lexer_T* lexer, int offset);

bool lexer_peek_for_html_comment_start(const lexer_T* lexer, int offset);
bool lexer_peek_for_html_comment_end(const lexer_T* lexer, int offset);

bool lexer_peek_erb_close_tag(const lexer_T* lexer, int offset);
bool lexer_peek_erb_dash_close_tag(const lexer_T* lexer, int offset);
bool lexer_peek_erb_percent_close_tag(const lexer_T* lexer, int offset);
bool lexer_peek_erb_end(const lexer_T* lexer, int offset);

char lexer_backtrack(const lexer_T* lexer, int offset);

bool lexer_peek_for_token_type_after_whitespace(lexer_T* lexer, token_type_T token_type);
bool lexer_peek_for_close_tag_start(const lexer_T* lexer, int offset);

lexer_state_snapshot_T lexer_save_state(lexer_T* lexer);
void lexer_restore_state(lexer_T* lexer, lexer_state_snapshot_T snapshot);

#endif
