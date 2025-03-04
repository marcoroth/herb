#include "include/lexer_peek_helpers.h"
#include "include/lexer_struct.h"
#include "include/macros.h"

#include <ctype.h>
#include <stdbool.h>

char lexer_backtrack(const lexer_T* lexer, const int offset) {
  return lexer->source[MAX(lexer->current_position - offset, 0)];
}

char lexer_peek(const lexer_T* lexer, const int offset) {
  return lexer->source[MIN(lexer->current_position + offset, lexer->source_length)];
}

bool lexer_peek_for(const lexer_T* lexer, const int offset, const char* pattern, const bool case_insensitive) {
  for (int index = 0; pattern[index]; index++) {
    const char character = lexer_peek(lexer, offset + index);

    if (case_insensitive) {
      if (tolower(character) != tolower(pattern[index])) { return false; }
    } else {
      if (character != pattern[index]) { return false; }
    }
  }

  return true;
}

bool lexer_peek_for_doctype(const lexer_T* lexer, const int offset) {
  return lexer_peek_for(lexer, offset, "<!DOCTYPE", true);
}

bool lexer_peek_for_html_comment_start(const lexer_T* lexer, const int offset) {
  return lexer_peek_for(lexer, offset, "<!--", false);
}

bool lexer_peek_for_html_comment_end(const lexer_T* lexer, const int offset) {
  return lexer_peek_for(lexer, offset, "-->", false);
}

bool lexer_peek_erb_close_tag(const lexer_T* lexer, const int offset) {
  return lexer_peek_for(lexer, offset, "%>", false);
}

bool lexer_peek_erb_dash_close_tag(const lexer_T* lexer, const int offset) {
  return lexer_peek_for(lexer, offset, "-%>", false);
}

bool lexer_peek_erb_percent_close_tag(const lexer_T* lexer, const int offset) {
  return lexer_peek_for(lexer, offset, "%%>", false);
}

bool lexer_peek_erb_end(const lexer_T* lexer, const int offset) {
  return (
    lexer_peek_erb_close_tag(lexer, offset) || lexer_peek_erb_dash_close_tag(lexer, offset)
    || lexer_peek_erb_percent_close_tag(lexer, offset)
  );
}
