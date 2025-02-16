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

bool lexer_peek_for_doctype(lexer_T* lexer, int offset) {
  return (lexer_peek(lexer, offset) == '<' && lexer_peek(lexer, offset + 1) == '!' &&
          tolower(lexer_peek(lexer, offset + 2)) == 'd' && tolower(lexer_peek(lexer, offset + 3)) == 'o' &&
          tolower(lexer_peek(lexer, offset + 4)) == 'c' && tolower(lexer_peek(lexer, offset + 5)) == 't' &&
          tolower(lexer_peek(lexer, offset + 6)) == 'y' && tolower(lexer_peek(lexer, offset + 7)) == 'p' &&
          tolower(lexer_peek(lexer, offset + 8)) == 'e');
}

bool lexer_peek_for_html_comment_start(lexer_T* lexer, int offset) {
  return (lexer_peek(lexer, offset) == '<' && lexer_peek(lexer, offset + 1) == '!' &&
          lexer_peek(lexer, offset + 2) == '-' && lexer_peek(lexer, offset + 3) == '-');
}

bool lexer_peek_for_html_comment_end(lexer_T* lexer, int offset) {
  return (
      lexer_peek(lexer, offset) == '-' && lexer_peek(lexer, offset + 1) == '-' && lexer_peek(lexer, offset + 2) == '>');
}

bool lexer_peek_erb_close_tag(lexer_T* lexer, int offset) {
  return (lexer_peek(lexer, offset + 0) == '%' && lexer_peek(lexer, offset + 1) == '>');
}

bool lexer_peek_erb_dash_close_tag(lexer_T* lexer, int offset) {
  return (lexer_peek(lexer, offset + 0) == '-' && lexer_peek(lexer, offset + 1) == '%' &&
          lexer_peek(lexer, offset + 2) == '>');
}

bool lexer_peek_erb_percent_close_tag(lexer_T* lexer, int offset) {
  return (lexer_peek(lexer, offset + 0) == '%' && lexer_peek(lexer, offset + 1) == '%' &&
          lexer_peek(lexer, offset + 2) == '>');
}

bool lexer_peek_erb_end(lexer_T* lexer, int offset) {
  return (lexer_peek_erb_close_tag(lexer, offset) || lexer_peek_erb_dash_close_tag(lexer, offset) ||
          lexer_peek_erb_percent_close_tag(lexer, offset));
}
