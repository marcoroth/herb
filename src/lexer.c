#include "include/lexer_peek_helpers.h"
#include "include/token.h"
#include "include/utf8.h"
#include "include/util.h"
#include "include/util/hb_buffer.h"
#include "include/util/hb_string.h"

#include <ctype.h>
#include <string.h>

#define LEXER_STALL_LIMIT 5

static bool lexer_eof(const lexer_T* lexer) {
  return lexer->current_character == '\0' || lexer->stalled;
}

static bool lexer_has_more_characters(const lexer_T* lexer) {
  return lexer->current_position < lexer->source.length;
}

static bool lexer_stalled(lexer_T* lexer) {
  if (lexer->last_position == lexer->current_position) {
    lexer->stall_counter++;

    if (lexer->stall_counter > LEXER_STALL_LIMIT) { lexer->stalled = true; }
  } else {
    lexer->stall_counter = 0;
    lexer->last_position = lexer->current_position;
  }

  return lexer->stalled;
}

void lexer_init(lexer_T* lexer, const char* source) {
  if (source != NULL) {
    lexer->source = hb_string(source);
  } else {
    lexer->source = hb_string("");
  }

  lexer->current_character = lexer->source.data[0];
  lexer->state = STATE_DATA;

  lexer->current_line = 1;
  lexer->current_column = 0;
  lexer->current_position = 0;

  lexer->previous_line = lexer->current_line;
  lexer->previous_column = lexer->current_column;
  lexer->previous_position = lexer->current_position;

  lexer->stall_counter = 0;
  lexer->last_position = 0;
  lexer->stalled = false;
}

token_T* lexer_error(lexer_T* lexer, const char* message) {
  char error_message[128];

  snprintf(
    error_message,
    sizeof(error_message),
    "[Lexer] Error: %s (character '%c', line %u, col %u)\n",
    message,
    lexer->current_character,
    lexer->current_line,
    lexer->current_column
  );

  return token_init(hb_string(error_message), TOKEN_ERROR, lexer);
}

static void lexer_advance(lexer_T* lexer) {
  if (lexer_has_more_characters(lexer) && !lexer_eof(lexer)) {
    if (!is_newline(lexer->current_character)) { lexer->current_column++; }

    lexer->current_position++;
    lexer->current_character = lexer->source.data[lexer->current_position];
  }
}

static void lexer_advance_utf8_bytes(lexer_T* lexer, int byte_count) {
  if (byte_count <= 0) { return; }

  if (lexer_has_more_characters(lexer) && !lexer_eof(lexer)) {
    if (!is_newline(lexer->current_character)) { lexer->current_column++; }

    lexer->current_position += byte_count;

    if (lexer->current_position >= lexer->source.length) {
      lexer->current_position = lexer->source.length;
      lexer->current_character = '\0';
    } else {
      lexer->current_character = lexer->source.data[lexer->current_position];
    }
  }
}

static void lexer_advance_by(lexer_T* lexer, const size_t count) {
  for (size_t i = 0; i < count; i++) {
    lexer_advance(lexer);
  }
}

static token_T* lexer_advance_with(lexer_T* lexer, hb_string_T value, const token_type_T type) {
  lexer_advance_by(lexer, value.length);
  return token_init(value, type, lexer);
}

static token_T* lexer_advance_with_next(lexer_T* lexer, size_t count, token_type_T type) {
  uint32_t start_position = lexer->current_position;

  for (size_t i = 0; i < count; i++) {
    lexer_advance(lexer);
  }

  token_T* token = token_init(hb_string_range(lexer->source, start_position, lexer->current_position), type, lexer);

  return token;
}

static token_T* lexer_advance_current(lexer_T* lexer, const token_type_T type) {
  char buffer[2];
  buffer[0] = lexer->current_character;
  buffer[1] = '\0';

  return lexer_advance_with(lexer, hb_string(buffer), type);
}

static token_T* lexer_advance_utf8_character(lexer_T* lexer, const token_type_T type) {
  int char_byte_length = utf8_sequence_length(lexer->source.data, lexer->current_position, lexer->source.length);
  if (char_byte_length <= 1) { return lexer_advance_current(lexer, type); }
  uint32_t start_position = lexer->current_position;

  for (int i = 0; i < char_byte_length; i++) {
    if (lexer->current_position + i >= lexer->source.length) { return lexer_advance_current(lexer, type); }
  }

  lexer_advance_utf8_bytes(lexer, char_byte_length);

  token_T* token = token_init(hb_string_range(lexer->source, start_position, lexer->current_position), type, lexer);

  return token;
}

static token_T* lexer_match_and_advance(lexer_T* lexer, hb_string_T value, const token_type_T type) {
  hb_string_T remaining_source = hb_string_slice(lexer->source, lexer->current_position);
  if (hb_string_starts_with(remaining_source, value)) { return lexer_advance_with(lexer, value, type); }

  return NULL;
}

// ===== Specialized Parsers

static token_T* lexer_parse_whitespace(lexer_T* lexer) {
  uint32_t start_position = lexer->current_position;

  while (isspace(lexer->current_character) && lexer->current_character != '\n' && lexer->current_character != '\r'
         && !lexer_eof(lexer)) {
    lexer_advance(lexer);
  }

  token_T* token =
    token_init(hb_string_range(lexer->source, start_position, lexer->current_position), TOKEN_WHITESPACE, lexer);

  return token;
}

static token_T* lexer_parse_identifier(lexer_T* lexer) {
  uint32_t start_position = lexer->current_position;

  while ((isalnum(lexer->current_character) || lexer->current_character == '-' || lexer->current_character == '_'
          || lexer->current_character == ':')
         && !lexer_peek_for_html_comment_end(lexer, 0) && !lexer_eof(lexer)) {

    lexer_advance(lexer);
  }

  token_T* token =
    token_init(hb_string_range(lexer->source, start_position, lexer->current_position), TOKEN_IDENTIFIER, lexer);

  return token;
}

// ===== ERB Parsing

static token_T* lexer_parse_erb_open(lexer_T* lexer) {
  hb_string_T erb_patterns[] = { hb_string("<%=="), hb_string("<%%="), hb_string("<%="),       hb_string("<%#"),
                                 hb_string("<%-"),  hb_string("<%%"),  hb_string("<%graphql"), hb_string("<%") };

  lexer->state = STATE_ERB_CONTENT;

  for (size_t i = 0; i < sizeof(erb_patterns) / sizeof(erb_patterns[0]); i++) {
    token_T* match = lexer_match_and_advance(lexer, erb_patterns[i], TOKEN_ERB_START);
    if (match) { return match; }
  }

  return lexer_error(lexer, "Unexpected ERB start");
}

static token_T* lexer_parse_erb_content(lexer_T* lexer) {
  uint32_t start_position = lexer->current_position;

  while (!lexer_peek_erb_end(lexer, 0)) {
    if (lexer_eof(lexer)) {
      token_T* token = token_init(
        hb_string_range(lexer->source, start_position, lexer->current_position),
        TOKEN_ERROR,
        lexer
      ); // Handle unexpected EOF

      return token;
    }

    if (is_newline(lexer->current_character)) {
      lexer->current_line++;
      lexer->current_column = 0;
    } else {
      lexer->current_column++;
    }

    lexer->current_position++;
    lexer->current_character = lexer->source.data[lexer->current_position];
  }

  lexer->state = STATE_ERB_CLOSE;

  token_T* token =
    token_init(hb_string_range(lexer->source, start_position, lexer->current_position), TOKEN_ERB_CONTENT, lexer);

  return token;
}

static token_T* lexer_parse_erb_close(lexer_T* lexer) {
  lexer->state = STATE_DATA;

  if (lexer_peek_erb_percent_close_tag(lexer, 0)) { return lexer_advance_with(lexer, hb_string("%%>"), TOKEN_ERB_END); }
  if (lexer_peek_erb_equals_close_tag(lexer, 0)) { return lexer_advance_with(lexer, hb_string("=%>"), TOKEN_ERB_END); }
  if (lexer_peek_erb_dash_close_tag(lexer, 0)) { return lexer_advance_with(lexer, hb_string("-%>"), TOKEN_ERB_END); }

  return lexer_advance_with(lexer, hb_string("%>"), TOKEN_ERB_END);
}

// ===== Tokenizing Function

token_T* lexer_next_token(lexer_T* lexer) {
  if (lexer_eof(lexer)) { return token_init(hb_string(""), TOKEN_EOF, lexer); }
  if (lexer_stalled(lexer)) { return lexer_error(lexer, "Lexer stalled after 5 iterations"); }

  if (lexer->state == STATE_ERB_CONTENT) { return lexer_parse_erb_content(lexer); }
  if (lexer->state == STATE_ERB_CLOSE) { return lexer_parse_erb_close(lexer); }

  if (lexer->current_character == '\r' && lexer_peek(lexer, 1) == '\n') {
    return lexer_advance_with_next(lexer, 2, TOKEN_NEWLINE);
  }
  if (lexer->current_character == '\n') { return lexer_advance_current(lexer, TOKEN_NEWLINE); }
  if (lexer->current_character == '\r') { return lexer_advance_current(lexer, TOKEN_NEWLINE); }

  if (isspace(lexer->current_character)) { return lexer_parse_whitespace(lexer); }

  if (lexer->current_character == '\xC2' && lexer_peek(lexer, 1) == '\xA0') {
    return lexer_advance_utf8_character(lexer, TOKEN_NBSP);
  }

  switch (lexer->current_character) {
    case '<': {
      if (lexer_peek(lexer, 1) == '%') { return lexer_parse_erb_open(lexer); }

      if (lexer_peek_for_doctype(lexer, 0)) {
        return lexer_advance_with_next(lexer, strlen("<!DOCTYPE"), TOKEN_HTML_DOCTYPE);
      }

      if (lexer_peek_for_xml_declaration(lexer, 0)) {
        return lexer_advance_with_next(lexer, strlen("<?xml"), TOKEN_XML_DECLARATION);
      }

      if (lexer_peek_for_cdata_start(lexer, 0)) {
        return lexer_advance_with_next(lexer, strlen("<![CDATA["), TOKEN_CDATA_START);
      }

      if (isalpha(lexer_peek(lexer, 1))) { return lexer_advance_current(lexer, TOKEN_HTML_TAG_START); }

      if (lexer_peek_for_html_comment_start(lexer, 0)) {
        return lexer_advance_with(lexer, hb_string("<!--"), TOKEN_HTML_COMMENT_START);
      }

      if (lexer_peek_for_close_tag_start(lexer, 0)) {
        return lexer_advance_with(lexer, hb_string("</"), TOKEN_HTML_TAG_START_CLOSE);
      }

      return lexer_advance_current(lexer, TOKEN_LT);
    }

    case '/': {
      token_T* token = lexer_match_and_advance(lexer, hb_string("/>"), TOKEN_HTML_TAG_SELF_CLOSE);
      return token ? token : lexer_advance_current(lexer, TOKEN_SLASH);
    }

    case '?': {
      token_T* token = lexer_match_and_advance(lexer, hb_string("?>"), TOKEN_XML_DECLARATION_END);
      return token ? token : lexer_advance_current(lexer, TOKEN_CHARACTER);
    }

    case '-': {
      token_T* token = lexer_match_and_advance(lexer, hb_string("-->"), TOKEN_HTML_COMMENT_END);
      return token ? token : lexer_advance_current(lexer, TOKEN_DASH);
    }

    case ']': {
      token_T* token = lexer_match_and_advance(lexer, hb_string("]]>"), TOKEN_CDATA_END);
      return token ? token : lexer_advance_current(lexer, TOKEN_CHARACTER);
    }

    case '>': return lexer_advance_current(lexer, TOKEN_HTML_TAG_END);
    case '_': return lexer_advance_current(lexer, TOKEN_UNDERSCORE);
    case ':': return lexer_advance_current(lexer, TOKEN_COLON);
    case '@': return lexer_advance_current(lexer, TOKEN_AT);
    case ';': return lexer_advance_current(lexer, TOKEN_SEMICOLON);
    case '&': return lexer_advance_current(lexer, TOKEN_AMPERSAND);
    case '!': return lexer_advance_current(lexer, TOKEN_EXCLAMATION);
    case '=': return lexer_advance_current(lexer, TOKEN_EQUALS);
    case '%': return lexer_advance_current(lexer, TOKEN_PERCENT);

    case '"':
    case '\'': return lexer_advance_current(lexer, TOKEN_QUOTE);
    case '`': return lexer_advance_current(lexer, TOKEN_BACKTICK);
    case '\\': return lexer_advance_current(lexer, TOKEN_BACKSLASH);

    default: {
      if (isalnum(lexer->current_character)) { return lexer_parse_identifier(lexer); }

      return lexer_advance_utf8_character(lexer, TOKEN_CHARACTER);
    }
  }
}
