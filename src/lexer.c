#include "include/lexer/lexer.h"
#include "include/lexer/lexer_peek_helpers.h"
#include "include/lexer/token.h"
#include "include/lib/hb_string.h"
#include "include/macros.h"
#include "include/util/utf8.h"
#include "include/util/util.h"

#include <ctype.h>
#include <stdint.h>
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

void lexer_init(lexer_T* lexer, const char* source, hb_allocator_T* allocator) {
  lexer->allocator = allocator;

  if (source != NULL) {
    lexer->source = hb_string(source);
  } else {
    lexer->source = HB_STRING_EMPTY;
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
  lexer->pending_close = NUNJUCKS_DELIMITER_NONE;
  lexer->pending_close_length = 0;
  lexer->pending_raw = NUNJUCKS_RAW_NONE;
  lexer->open_raw = NUNJUCKS_RAW_NONE;
}

token_T* lexer_error(lexer_T* lexer, const char* message) {
  char buffer[128];

  snprintf(
    buffer,
    sizeof(buffer),
    "[Lexer] Error: %s (character '%c', line %u, col %u)\n",
    message,
    lexer->current_character,
    lexer->current_line,
    lexer->current_column
  );

  size_t length = strlen(buffer);
  char* error_message = hb_allocator_strndup(lexer->allocator, buffer, length);

  return token_init(hb_string_from_data(error_message, length), TOKEN_ERROR, lexer);
}

static void lexer_advance(lexer_T* lexer) {
  if (lexer_has_more_characters(lexer) && !lexer_eof(lexer)) {
    if (!is_newline(lexer->current_character)) { lexer->current_column++; }

    lexer->current_position++;
    lexer->current_character = lexer->source.data[lexer->current_position];
  }
}

static void lexer_advance_utf8_bytes(lexer_T* lexer, uint32_t byte_count) {
  if (byte_count == 0) { return; }

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
  return lexer_advance_with_next(lexer, 1, type);
}

static token_T* lexer_advance_utf8_character(lexer_T* lexer, const token_type_T type) {
  uint32_t char_byte_length = utf8_sequence_length(hb_string_slice(lexer->source, lexer->current_position));

  if (char_byte_length <= 1) { return lexer_advance_current(lexer, type); }

  uint32_t start_position = lexer->current_position;

  for (uint32_t i = 0; i < char_byte_length; i++) {
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
         && !lexer_peek_for_html_comment_end(lexer, 0) && !lexer_peek_for_html_comment_invalid_end(lexer, 0)
         && !lexer_eof(lexer)) {

    lexer_advance(lexer);
  }

  token_T* token =
    token_init(hb_string_range(lexer->source, start_position, lexer->current_position), TOKEN_IDENTIFIER, lexer);

  return token;
}

// ===== Nunjucks Parsing

static void lexer_advance_raw(lexer_T* lexer) {
  if (lexer->current_position >= lexer->source.length) {
    lexer->current_character = '\0';
    return;
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

static token_T* lexer_parse_nunjucks_open(lexer_T* lexer) {
  token_type_T type;

  if (lexer_peek_nunjucks_output_start(lexer, 0)) {
    lexer->state = STATE_NUNJUCKS_OUTPUT;
    lexer->pending_close = NUNJUCKS_DELIMITER_OUTPUT;
    type = TOKEN_NUNJUCKS_OUTPUT_START;
  } else if (lexer_peek_nunjucks_tag_start(lexer, 0)) {
    lexer->state = STATE_NUNJUCKS_TAG;
    lexer->pending_close = NUNJUCKS_DELIMITER_TAG;
    type = TOKEN_NUNJUCKS_TAG_START;
  } else {
    lexer->state = STATE_NUNJUCKS_COMMENT;
    lexer->pending_close = NUNJUCKS_DELIMITER_COMMENT;
    type = TOKEN_NUNJUCKS_COMMENT_START;
  }

  size_t length = (lexer_peek(lexer, 2) == '-') ? 3 : 2;

  return lexer_advance_with_next(lexer, length, type);
}

static bool lexer_peek_nunjucks_end_for(const lexer_T* lexer, nunjucks_delimiter_T delimiter) {
  switch (delimiter) {
    case NUNJUCKS_DELIMITER_OUTPUT: return lexer_peek_nunjucks_output_end(lexer, 0);
    case NUNJUCKS_DELIMITER_TAG: return lexer_peek_nunjucks_tag_end(lexer, 0);
    case NUNJUCKS_DELIMITER_COMMENT: return lexer_peek_nunjucks_comment_end(lexer, 0);
    case NUNJUCKS_DELIMITER_NONE: return false;
  }

  return false;
}

static nunjucks_raw_kind_T lexer_raw_kind_from_content(hb_string_T content) {
  hb_string_T keyword = hb_string_trim(content);

  if (hb_string_equals(keyword, hb_string("raw"))) { return NUNJUCKS_RAW_RAW; }
  if (hb_string_equals(keyword, hb_string("verbatim"))) { return NUNJUCKS_RAW_VERBATIM; }

  return NUNJUCKS_RAW_NONE;
}

static token_T* lexer_parse_nunjucks_content(lexer_T* lexer) {
  uint32_t start_position = lexer->current_position;
  bool skip_strings = (lexer->pending_close != NUNJUCKS_DELIMITER_COMMENT);

  while (!lexer_eof(lexer) && !lexer_peek_nunjucks_end_for(lexer, lexer->pending_close)) {
    if (skip_strings && (lexer->current_character == '"' || lexer->current_character == '\'')) {
      char quote = lexer->current_character;

      lexer_advance_raw(lexer);

      while (!lexer_eof(lexer) && lexer->current_character != quote) {
        if (lexer->current_character == '\\' && lexer_peek(lexer, 1) != '\0') { lexer_advance_raw(lexer); }

        lexer_advance_raw(lexer);
      }

      if (!lexer_eof(lexer)) { lexer_advance_raw(lexer); }

      continue;
    }

    lexer_advance_raw(lexer);
  }

  hb_string_T value = hb_string_range(lexer->source, start_position, lexer->current_position);

  if (lexer_eof(lexer)) {
    lexer->state = STATE_DATA;
    lexer->pending_close = NUNJUCKS_DELIMITER_NONE;
  } else {
    lexer->state = STATE_NUNJUCKS_CLOSE;

    if (lexer->pending_close == NUNJUCKS_DELIMITER_TAG) { lexer->pending_raw = lexer_raw_kind_from_content(value); }
  }

  return token_init(value, TOKEN_NUNJUCKS_CONTENT, lexer);
}

static token_T* lexer_parse_nunjucks_close(lexer_T* lexer) {
  token_type_T type;

  switch (lexer->pending_close) {
    case NUNJUCKS_DELIMITER_OUTPUT: type = TOKEN_NUNJUCKS_OUTPUT_END; break;
    case NUNJUCKS_DELIMITER_TAG: type = TOKEN_NUNJUCKS_TAG_END; break;
    case NUNJUCKS_DELIMITER_COMMENT:
    case NUNJUCKS_DELIMITER_NONE: type = TOKEN_NUNJUCKS_COMMENT_END; break;
  }

  size_t length = (lexer->current_character == '-') ? 3 : 2;

  lexer->pending_close = NUNJUCKS_DELIMITER_NONE;

  if (lexer->pending_raw != NUNJUCKS_RAW_NONE) {
    lexer->open_raw = lexer->pending_raw;
    lexer->pending_raw = NUNJUCKS_RAW_NONE;
    lexer->state = STATE_NUNJUCKS_RAW;
  } else {
    lexer->state = STATE_DATA;
  }

  return lexer_advance_with_next(lexer, length, type);
}

static bool lexer_peek_nunjucks_raw_end(const lexer_T* lexer, nunjucks_raw_kind_T kind) {
  if (!lexer_peek_nunjucks_tag_start(lexer, 0)) { return false; }

  uint32_t position = lexer->current_position + 2;

  if (position < lexer->source.length && lexer->source.data[position] == '-') { position++; }

  while (position < lexer->source.length && isspace((unsigned char) lexer->source.data[position])) {
    position++;
  }

  hb_string_T keyword = (kind == NUNJUCKS_RAW_VERBATIM) ? hb_string("endverbatim") : hb_string("endraw");

  return hb_string_starts_with(hb_string_slice(lexer->source, position), keyword);
}

static token_T* lexer_parse_nunjucks_raw(lexer_T* lexer) {
  uint32_t start_position = lexer->current_position;
  nunjucks_raw_kind_T kind = lexer->open_raw;

  lexer->open_raw = NUNJUCKS_RAW_NONE;
  lexer->state = STATE_DATA;

  while (!lexer_eof(lexer) && !lexer_peek_nunjucks_raw_end(lexer, kind)) {
    lexer_advance_raw(lexer);
  }

  if (lexer->current_position == start_position) { return lexer_next_token(lexer); }

  return token_init(
    hb_string_range(lexer->source, start_position, lexer->current_position),
    TOKEN_NUNJUCKS_RAW_CONTENT,
    lexer
  );
}

// ===== Tokenizing Function

token_T* lexer_next_token(lexer_T* lexer) {
  if (lexer_eof(lexer)) { return token_init(HB_STRING_EMPTY, TOKEN_EOF, lexer); }
  if (lexer_stalled(lexer)) { return lexer_error(lexer, "Lexer stalled after 5 iterations"); }

  if (lexer->state == STATE_NUNJUCKS_OUTPUT || lexer->state == STATE_NUNJUCKS_TAG
      || lexer->state == STATE_NUNJUCKS_COMMENT) {
    return lexer_parse_nunjucks_content(lexer);
  }

  if (lexer->state == STATE_NUNJUCKS_CLOSE) { return lexer_parse_nunjucks_close(lexer); }
  if (lexer->state == STATE_NUNJUCKS_RAW) { return lexer_parse_nunjucks_raw(lexer); }

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
    case '{': {
      if (lexer_peek_nunjucks_start(lexer, 0)) { return lexer_parse_nunjucks_open(lexer); }

      return lexer_advance_current(lexer, TOKEN_CHARACTER);
    }

    case '<': {
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
      token_T* token = lexer_match_and_advance(lexer, hb_string("--!>"), TOKEN_HTML_COMMENT_INVALID_END);
      if (token) { return token; }

      token = lexer_match_and_advance(lexer, hb_string("-->"), TOKEN_HTML_COMMENT_END);
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
