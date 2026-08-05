#include "include/lexer/lexer_peek_helpers.h"
#include "include/lexer/token.h"
#include "include/lib/hb_string.h"
#include "include/macros.h"
#include "include/prism/ruby_parser.h"
#include "include/util/utf8.h"
#include "include/util/util.h"

#include <ctype.h>
#include <stdint.h>
#include <string.h>

#define LEXER_STALL_LIMIT 5
#define LEXER_ERB_END_CANDIDATE_LIMIT 16
#define LEXER_ERB_SPACED_DELIMITER_LIMIT 8

typedef enum {
  ERB_END_CANDIDATE_PERCENT,
  ERB_END_CANDIDATE_HTML_TAG,
  ERB_END_CANDIDATE_ANGLE_BRACKET,
} erb_end_candidate_kind_T;

typedef struct {
  uint32_t position;
  uint32_t line;
  uint32_t column;
  uint8_t delimiter_length;
  erb_end_candidate_kind_T kind;
} erb_end_candidate_T;

static hb_string_T erb_open_patterns[] = HB_STRING_LIST("<%==", "<%%=", "<%graphql", "<%=", "<%#", "<%-", "<%%", "<%");

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
  lexer->malformed_erb_close_length = 0;
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

// ===== ERB Parsing

static token_T* lexer_parse_erb_open(lexer_T* lexer) {
  lexer->state = STATE_ERB_CONTENT;

  if (lexer_peek(lexer, 2) == '%' && lexer_peek(lexer, 3) == '>') {
    return lexer_advance_with(lexer, hb_string("<%"), TOKEN_ERB_START);
  }

  for (size_t i = 0; i < sizeof(erb_open_patterns) / sizeof(erb_open_patterns[0]); i++) {
    token_T* match = lexer_match_and_advance(lexer, erb_open_patterns[i], TOKEN_ERB_START);
    if (match) { return match; }
  }

  return lexer_error(lexer, "Unexpected ERB start");
}

static uint8_t lexer_erb_percent_delimiter_length(const lexer_T* lexer) {
  if (lexer->current_character != '%') { return 0; }

  char next = lexer_peek(lexer, 1);

  if (is_newline(next) || next == '<' || next == '"' || next == '\'' || next == '\0') { return 1; }

  for (uint8_t offset = 1; offset <= LEXER_ERB_SPACED_DELIMITER_LIMIT; offset++) {
    char character = lexer_peek(lexer, offset);

    if (character == '>') { return offset + 1; }
    if (character != ' ' && character != '\t') { break; }
  }

  return 0;
}

static bool lexer_recover_erb_tag_end(
  lexer_T* lexer,
  uint32_t start_position,
  const erb_end_candidate_T* candidates,
  size_t candidate_count
) {
  for (int pass = ERB_END_CANDIDATE_PERCENT; pass <= ERB_END_CANDIDATE_ANGLE_BRACKET; pass++) {
    bool last_first = (pass == ERB_END_CANDIDATE_ANGLE_BRACKET);

    for (size_t offset = 0; offset < candidate_count; offset++) {
      const erb_end_candidate_T* candidate = &candidates[last_first ? candidate_count - 1 - offset : offset];

      if (candidate->kind != (erb_end_candidate_kind_T) pass) { continue; }

      if (!herb_ruby_fragment_is_parseable(hb_string_range(lexer->source, start_position, candidate->position))) {
        continue;
      }

      lexer->current_position = candidate->position;
      lexer->current_line = candidate->line;
      lexer->current_column = candidate->column;
      lexer->current_character = lexer->source.data[candidate->position];

      if (candidate->delimiter_length > 0) {
        lexer->state = STATE_ERB_CLOSE;
        lexer->malformed_erb_close_length = candidate->delimiter_length;
      } else {
        lexer->state = STATE_DATA;
      }

      return true;
    }
  }

  return false;
}

static token_T* lexer_parse_erb_content(lexer_T* lexer) {
  uint32_t start_position = lexer->current_position;

  erb_end_candidate_T candidates[LEXER_ERB_END_CANDIDATE_LIMIT];
  size_t candidate_count = 0;

  while (!lexer_peek_erb_end(lexer, 0)) {
    if (lexer_eof(lexer) || lexer_peek_erb_start(lexer, 0)) {
      if (!lexer_recover_erb_tag_end(lexer, start_position, candidates, candidate_count) && !lexer_eof(lexer)) {
        lexer->state = STATE_DATA;
      }

      token_T* token =
        token_init(hb_string_range(lexer->source, start_position, lexer->current_position), TOKEN_ERB_CONTENT, lexer);

      return token;
    }

    if (candidate_count < LEXER_ERB_END_CANDIDATE_LIMIT) {
      char next = lexer_peek(lexer, 1);
      uint8_t trailing = lexer_erb_percent_delimiter_length(lexer);

      if (trailing > 0) {
        uint8_t leading = 0;

        if (lexer->current_position > start_position) {
          char preceding = lexer->source.data[lexer->current_position - 1];

          if (preceding == '-' || preceding == '=' || preceding == '%') { leading = 1; }
        }

        candidates[candidate_count++] = (erb_end_candidate_T) { .position = lexer->current_position - leading,
                                                                .line = lexer->current_line,
                                                                .column = lexer->current_column - leading,
                                                                .delimiter_length = leading + trailing,
                                                                .kind = ERB_END_CANDIDATE_PERCENT };
      } else if (lexer->current_character == '<'
                 && (isalpha(next) || next == '!' || (next == '/' && isalpha(lexer_peek(lexer, 2))))) {
        candidates[candidate_count++] = (erb_end_candidate_T) { .position = lexer->current_position,
                                                                .line = lexer->current_line,
                                                                .column = lexer->current_column,
                                                                .delimiter_length = 0,
                                                                .kind = ERB_END_CANDIDATE_HTML_TAG };
      } else if (lexer->current_character == '>') {
        candidates[candidate_count++] = (erb_end_candidate_T) { .position = lexer->current_position,
                                                                .line = lexer->current_line,
                                                                .column = lexer->current_column,
                                                                .delimiter_length = 1,
                                                                .kind = ERB_END_CANDIDATE_ANGLE_BRACKET };
      }
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

  if (lexer->malformed_erb_close_length > 0) {
    uint8_t length = lexer->malformed_erb_close_length;
    lexer->malformed_erb_close_length = 0;

    return lexer_advance_with_next(lexer, length, TOKEN_ERB_END);
  }

  if (lexer_peek_erb_percent_close_tag(lexer, 0)) { return lexer_advance_with(lexer, hb_string("%%>"), TOKEN_ERB_END); }
  if (lexer_peek_erb_equals_close_tag(lexer, 0)) { return lexer_advance_with(lexer, hb_string("=%>"), TOKEN_ERB_END); }
  if (lexer_peek_erb_dash_close_tag(lexer, 0)) { return lexer_advance_with(lexer, hb_string("-%>"), TOKEN_ERB_END); }

  return lexer_advance_with(lexer, hb_string("%>"), TOKEN_ERB_END);
}

// ===== Tokenizing Function

token_T* lexer_next_token(lexer_T* lexer) {
  if (lexer_eof(lexer)) { return token_init(HB_STRING_EMPTY, TOKEN_EOF, lexer); }
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
