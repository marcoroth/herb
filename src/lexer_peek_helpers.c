#include "include/lexer_peek_helpers.h"
#include "include/lexer.h"
#include "include/lexer_struct.h"
#include "include/macros.h"
#include "include/token.h"
#include "include/util/hb_string.h"

#include <ctype.h>
#include <stdbool.h>

char lexer_backtrack(const lexer_T* lexer, uint32_t offset) {
  return lexer->source.data[MAX(lexer->current_position - offset, 0)];
}

char lexer_peek(const lexer_T* lexer, uint32_t offset) {
  return lexer->source.data[MIN(lexer->current_position + offset, lexer->source.length)];
}

bool lexer_peek_for(const lexer_T* lexer, uint32_t offset, hb_string_T pattern, const bool case_insensitive) {
  for (uint32_t index = 0; index < pattern.length; index++) {
    const char character = lexer_peek(lexer, offset + index);

    if (case_insensitive) {
      if (tolower(character) != tolower(pattern.data[index])) { return false; }
    } else {
      if (character != pattern.data[index]) { return false; }
    }
  }

  return true;
}

bool lexer_peek_for_doctype(const lexer_T* lexer, uint32_t offset) {
  return lexer_peek_for(lexer, offset, hb_string_from_c_string("<!DOCTYPE"), true);
}

bool lexer_peek_for_xml_declaration(const lexer_T* lexer, uint32_t offset) {
  return lexer_peek_for(lexer, offset, hb_string_from_c_string("<?xml"), true);
}

bool lexer_peek_for_cdata_start(const lexer_T* lexer, uint32_t offset) {
  return lexer_peek_for(lexer, offset, hb_string_from_c_string("<![CDATA["), false);
}

bool lexer_peek_for_cdata_end(const lexer_T* lexer, uint32_t offset) {
  return lexer_peek_for(lexer, offset, hb_string_from_c_string("]]>"), false);
}

bool lexer_peek_for_html_comment_start(const lexer_T* lexer, uint32_t offset) {
  return lexer_peek_for(lexer, offset, hb_string_from_c_string("<!--"), false);
}

bool lexer_peek_for_html_comment_end(const lexer_T* lexer, uint32_t offset) {
  return lexer_peek_for(lexer, offset, hb_string_from_c_string("-->"), false);
}

bool lexer_peek_erb_close_tag(const lexer_T* lexer, uint32_t offset) {
  return lexer_peek_for(lexer, offset, hb_string_from_c_string("%>"), false);
}

bool lexer_peek_erb_dash_close_tag(const lexer_T* lexer, uint32_t offset) {
  return lexer_peek_for(lexer, offset, hb_string_from_c_string("-%>"), false);
}

bool lexer_peek_erb_percent_close_tag(const lexer_T* lexer, uint32_t offset) {
  return lexer_peek_for(lexer, offset, hb_string_from_c_string("%%>"), false);
}

bool lexer_peek_erb_equals_close_tag(const lexer_T* lexer, uint32_t offset) {
  return lexer_peek_for(lexer, offset, hb_string_from_c_string("=%>"), false);
}

bool lexer_peek_erb_end(const lexer_T* lexer, uint32_t offset) {
  return (
    lexer_peek_erb_close_tag(lexer, offset) || lexer_peek_erb_dash_close_tag(lexer, offset)
    || lexer_peek_erb_percent_close_tag(lexer, offset) || lexer_peek_erb_equals_close_tag(lexer, offset)
  );
}

bool lexer_peek_for_token_type_after_whitespace(lexer_T* lexer, token_type_T token_type) {
  uint32_t saved_position = lexer->current_position;
  uint32_t saved_line = lexer->current_line;
  uint32_t saved_column = lexer->current_column;
  char saved_character = lexer->current_character;
  lexer_state_T saved_state = lexer->state;

  token_T* token = lexer_next_token(lexer);

  while (token && (token->type == TOKEN_WHITESPACE || token->type == TOKEN_NEWLINE)) {
    token_free(token);
    token = lexer_next_token(lexer);
  }

  bool result = (token && token->type == token_type);

  if (token) { token_free(token); }

  lexer->current_position = saved_position;
  lexer->current_line = saved_line;
  lexer->current_column = saved_column;
  lexer->current_character = saved_character;
  lexer->state = saved_state;

  return result;
}

bool lexer_peek_for_close_tag_start(const lexer_T* lexer, uint32_t offset) {
  if (lexer_peek(lexer, offset) != '<' || lexer_peek(lexer, offset + 1) != '/') { return false; }

  int pos = offset + 2;

  while (lexer_peek(lexer, pos) == ' ' || lexer_peek(lexer, pos) == '\t' || lexer_peek(lexer, pos) == '\n'
         || lexer_peek(lexer, pos) == '\r') {
    pos++;
  }

  char c = lexer_peek(lexer, pos);

  return isalpha(c) || c == '_';
}

lexer_state_snapshot_T lexer_save_state(lexer_T* lexer) {
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

void lexer_restore_state(lexer_T* lexer, lexer_state_snapshot_T snapshot) {
  lexer->current_position = snapshot.position;
  lexer->current_line = snapshot.line;
  lexer->current_column = snapshot.column;
  lexer->previous_position = snapshot.previous_position;
  lexer->previous_line = snapshot.previous_line;
  lexer->previous_column = snapshot.previous_column;
  lexer->current_character = snapshot.current_character;
  lexer->state = snapshot.state;
}
