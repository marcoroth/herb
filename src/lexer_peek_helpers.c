#include "include/lexer_peek_helpers.h"
#include "include/lexer_struct.h"
#include "include/macros.h"

#include <ctype.h>
#include <stdbool.h>

char lexer_backtrack(lexer_T* lexer, int offset) {
  return lexer->source[MAX(lexer->current_position - offset, 0)];
}

char lexer_peek(lexer_T* lexer, int offset) {
  return lexer->source[MIN(lexer->current_position + offset, lexer->source_length)];
}

bool lexer_peek_for(lexer_T* lexer, int offset, const char* pattern, bool case_insensitive) {
  for (int index = 0; pattern[index]; index++) {
    char character = lexer_peek(lexer, offset + index);

    if (case_insensitive) {
      if (tolower(character) != tolower(pattern[index])) return false;
    } else {
      if (character != pattern[index]) return false;
    }
  }

  return true;
}

bool lexer_peek_for_doctype(lexer_T* lexer, int offset) {
  return lexer_peek_for(lexer, offset, "<!DOCTYPE", true);
}

bool lexer_peek_for_html_comment_start(lexer_T* lexer, int offset) {
  return lexer_peek_for(lexer, offset, "<!--", true);
}

bool lexer_peek_for_html_comment_end(lexer_T* lexer, int offset) {
  return lexer_peek_for(lexer, offset, "-->", true);
}

bool lexer_peek_erb_close_tag(lexer_T* lexer, int offset) {
  return lexer_peek_for(lexer, offset, "%>", true);
}

bool lexer_peek_erb_dash_close_tag(lexer_T* lexer, int offset) {
  return lexer_peek_for(lexer, offset, "-%>", true);
}

bool lexer_peek_erb_percent_close_tag(lexer_T* lexer, int offset) {
  return lexer_peek_for(lexer, offset, "%%>", true);
}

bool lexer_peek_erb_end(lexer_T* lexer, int offset) {
  return (lexer_peek_erb_close_tag(lexer, offset) || lexer_peek_erb_dash_close_tag(lexer, offset) ||
          lexer_peek_erb_percent_close_tag(lexer, offset));
}
