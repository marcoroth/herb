#include "include/buffer.h"
#include "include/lexer_peek_helpers.h"
#include "include/token.h"
#include "include/util.h"

#include <ctype.h>
#include <stdio.h>
#include <string.h>

static size_t lexer_sizeof(void) {
  return sizeof(struct LEXER_STRUCT);
}

lexer_T* lexer_init(char* source) {
  if (source == NULL) source = "";

  lexer_T* lexer = calloc(1, lexer_sizeof());

  lexer->state = STATE_DATA;
  lexer->source = source;
  lexer->source_length = strlen(source);
  lexer->current_position = 0;
  lexer->current_line = 1;
  lexer->current_column = 1;
  lexer->current_character = source[0];

  return lexer;
}

token_T* lexer_error(lexer_T* lexer, const char* message) {
  char error_message[128];

  snprintf(error_message,
      sizeof(error_message),
      "[Lexer] Error: %s (character '%c', line %zu, col %zu)\n",
      message,
      lexer->current_character,
      lexer->current_line,
      lexer->current_column);

  return token_init(strdup(error_message), TOKEN_ERROR, lexer);
}

static void lexer_advance(lexer_T* lexer) {
  if (lexer->current_position < lexer->source_length && lexer->current_character != '\0') {

    if (is_newline(lexer->current_character)) {
      lexer->current_line += 1;
      lexer->current_column = 1;
    } else {
      lexer->current_column += 1;
    }

    lexer->current_position += 1;
    lexer->current_character = lexer->source[lexer->current_position];
  }
}

static void lexer_advance_by(lexer_T* lexer, size_t count) {
  for (size_t i = 0; i < count; i++)
    lexer_advance(lexer);
}

static token_T* lexer_advance_with(lexer_T* lexer, char* value, int type) {
  lexer_advance_by(lexer, strlen(value));

  return token_init(value, type, lexer);
}

static token_T* lexer_advance_current(lexer_T* lexer, int type) {
  char* value = calloc(2, sizeof(char));
  value[0] = lexer->current_character;
  value[1] = '\0';

  lexer_advance(lexer);
  token_T* token = token_init(value, type, lexer);

  return token;
}

static token_T* lexer_parse_whitespace(lexer_T* lexer) {
  buffer_T buffer = buffer_new();

  while (isspace(lexer->current_character) && lexer->current_character != 10 && lexer->current_character != 13) {
    buffer_append_char(&buffer, lexer->current_character);
    lexer_advance(lexer);
  }

  return token_init(buffer.value, TOKEN_WHITESPACE, lexer);
}

static token_T* lexer_parse_identifier(lexer_T* lexer) {
  buffer_T buffer = buffer_new();

  while ((isalnum(lexer->current_character) || lexer->current_character == '-' || lexer->current_character == '_' ||
             lexer->current_character == ':') &&
         !lexer_peek_for_html_comment_end(lexer, 0)) {
    buffer_append_char(&buffer, lexer->current_character);
    lexer_advance(lexer);
  }

  return token_init(buffer.value, TOKEN_IDENTIFIER, lexer);
}

static token_T* lexer_parse_text_content(lexer_T* lexer) {
  buffer_T buffer = buffer_new();

  while (lexer->current_character != '<' && lexer->current_character != '>' && lexer->current_character != '\0') {
    buffer_append_char(&buffer, lexer->current_character);
    lexer_advance(lexer);
  }

  return token_init(buffer.value, TOKEN_TEXT_CONTENT, lexer);
}

static token_T* lexer_parse_erb_open(lexer_T* lexer) {
  lexer->state = STATE_ERB_CONTENT;

  char next_char = lexer_peek(lexer, 2); // the next character after <%

  if (next_char == '=' && lexer_peek(lexer, 3) == '=') {
    return lexer_advance_with(lexer, "<%==", TOKEN_ERB_START);
  }

  if (next_char == '=') return lexer_advance_with(lexer, "<%=", TOKEN_ERB_START);
  if (next_char == '#') return lexer_advance_with(lexer, "<%#", TOKEN_ERB_START);
  if (next_char == '-') return lexer_advance_with(lexer, "<%-", TOKEN_ERB_START);
  if (next_char == '%') return lexer_advance_with(lexer, "<%%", TOKEN_ERB_START);

  return lexer_advance_with(lexer, "<%", TOKEN_ERB_START);
}

static token_T* lexer_parse_erb_content(lexer_T* lexer) {
  buffer_T buffer = buffer_new();

  while (!(lexer_peek_erb_end(lexer, 0))) {
    if (lexer->current_character == '\0') {
      return token_init(buffer.value, TOKEN_ERROR, lexer); // Handle unexpected EOF
    }

    buffer_append_char(&buffer, lexer->current_character);
    lexer_advance(lexer);
  }

  lexer->state = STATE_ERB_CLOSE;

  return token_init(buffer.value, TOKEN_ERB_CONTENT, lexer);
}

static token_T* lexer_parse_erb_close(lexer_T* lexer) {
  lexer->state = STATE_DATA;

  if (lexer_peek_erb_percent_close_tag(lexer, 0)) return lexer_advance_with(lexer, "%%>", TOKEN_ERB_END);
  if (lexer_peek_erb_dash_close_tag(lexer, 0)) return lexer_advance_with(lexer, "-%>", TOKEN_ERB_END);

  return lexer_advance_with(lexer, "%>", TOKEN_ERB_END);
}

token_T* lexer_next_token(lexer_T* lexer) {
  if (lexer->current_character == '\0') return token_init("", TOKEN_EOF, lexer);

  if (lexer->state == STATE_ERB_CONTENT) return lexer_parse_erb_content(lexer);
  if (lexer->state == STATE_ERB_CLOSE) return lexer_parse_erb_close(lexer);

  if (lexer->current_character == '\n') return lexer_advance_current(lexer, TOKEN_NEWLINE);
  if (isspace(lexer->current_character)) return lexer_parse_whitespace(lexer);

  switch (lexer->current_character) {
    case '<': {
      if (lexer_peek(lexer, 1) == '%') return lexer_parse_erb_open(lexer);
      if (lexer_peek_for_doctype(lexer, 0)) return lexer_advance_with(lexer, "<!DOCTYPE", TOKEN_HTML_DOCTYPE);
      if (isalnum(lexer_peek(lexer, 1))) return lexer_advance_current(lexer, TOKEN_HTML_TAG_START);

      if (lexer_peek_for_html_comment_start(lexer, 0)) {
        return lexer_advance_with(lexer, "<!--", TOKEN_HTML_COMMENT_START);
      }

      if (lexer_peek(lexer, 1) == '/' && isalnum(lexer_peek(lexer, 2))) {
        return lexer_advance_with(lexer, "</", TOKEN_HTML_TAG_START_CLOSE);
      }

      return lexer_advance_current(lexer, TOKEN_LT);
    }

    case '/': {
      if (lexer_peek(lexer, 1) == '>') return lexer_advance_with(lexer, "/>", TOKEN_HTML_TAG_SELF_CLOSE);
      return lexer_advance_current(lexer, TOKEN_SLASH);
    }

    case '-': {
      if (lexer_peek_for_html_comment_end(lexer, 0)) return lexer_advance_with(lexer, "-->", TOKEN_HTML_COMMENT_END);
      return lexer_advance_current(lexer, TOKEN_DASH);
    }

    case '>': return lexer_advance_current(lexer, TOKEN_HTML_TAG_END);
    case '_': return lexer_advance_current(lexer, TOKEN_UNDERSCORE);
    case ':': return lexer_advance_current(lexer, TOKEN_COLON);
    case '!': return lexer_advance_current(lexer, TOKEN_EXCLAMATION);
    case '=': return lexer_advance_current(lexer, TOKEN_EQUALS);
    case '%': return lexer_advance_current(lexer, TOKEN_PERCENT);

    case '"':
    case '\'': return lexer_advance_current(lexer, TOKEN_QUOTE);

    default: {
      if (isalnum(lexer->current_character) || lexer->current_character == '_') {
        return lexer_parse_identifier(lexer);
      }

      return lexer_parse_text_content(lexer);
    }
  }

  return lexer_error(lexer, "lexer_next_token");
}
