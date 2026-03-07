#include "include/lexer_peek_helpers.h"
#include "include/lexer.h"
#include "include/token.h"

#include <ctype.h>

static bool lexer_peek_for(const lexer_T* lexer, uint32_t offset, hb_string_T pattern, bool case_insensitive) {
  hb_string_T remaining_source = hb_string_slice(lexer->source, lexer->current_position + offset);
  remaining_source.length = MIN(pattern.length, remaining_source.length);

  if (case_insensitive) {
    return hb_string_equals_case_insensitive(remaining_source, pattern);
  } else {
    return hb_string_equals(remaining_source, pattern);
  }
}

bool lexer_peek_for_doctype(const lexer_T* lexer, uint32_t offset) {
  return lexer_peek_for(lexer, offset, hb_string("<!DOCTYPE"), true);
}

bool lexer_peek_for_xml_declaration(const lexer_T* lexer, uint32_t offset) {
  return lexer_peek_for(lexer, offset, hb_string("<?xml"), true);
}

bool lexer_peek_for_cdata_start(const lexer_T* lexer, uint32_t offset) {
  return lexer_peek_for(lexer, offset, hb_string("<![CDATA["), false);
}

bool lexer_peek_for_cdata_end(const lexer_T* lexer, uint32_t offset) {
  return lexer_peek_for(lexer, offset, hb_string("]]>"), false);
}

bool lexer_peek_for_html_comment_start(const lexer_T* lexer, uint32_t offset) {
  return lexer_peek_for(lexer, offset, hb_string("<!--"), false);
}

bool lexer_peek_for_close_tag_start(const lexer_T* lexer, uint32_t offset) {
  if (lexer_peek(lexer, offset) != '<' || lexer_peek(lexer, offset + 1) != '/') { return false; }

  uint32_t position = offset + 2;

  while (lexer_peek(lexer, position) == ' ' || lexer_peek(lexer, position) == '\t'
         || lexer_peek(lexer, position) == '\n' || lexer_peek(lexer, position) == '\r') {
    position++;
  }

  char character = lexer_peek(lexer, position);

  return isalpha(character) || character == '_';
}

bool lexer_peek_for_token_type_after_whitespace(lexer_T* lexer, token_type_T token_type) {
  uint32_t saved_position = lexer->current_position;
  uint32_t saved_line = lexer->current_line;
  uint32_t saved_column = lexer->current_column;
  char saved_character = lexer->current_character;
  lexer_state_T saved_state = lexer->state;

  token_T* token = lexer_next_token(lexer);

  while (token && (token->type == TOKEN_WHITESPACE || token->type == TOKEN_NEWLINE)) {
    token_free(token, lexer->allocator);
    token = lexer_next_token(lexer);
  }

  bool result = (token && token->type == token_type);

  if (token) { token_free(token, lexer->allocator); }

  lexer->current_position = saved_position;
  lexer->current_line = saved_line;
  lexer->current_column = saved_column;
  lexer->current_character = saved_character;
  lexer->state = saved_state;

  return result;
}
