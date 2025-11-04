#include "include/token.h"
#include "include/lexer.h"
#include "include/position.h"
#include "include/range.h"
#include "include/token_struct.h"
#include "include/util.h"
#include "include/util/hb_buffer.h"
#include "include/util/hb_string.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

size_t token_sizeof(void) {
  return sizeof(struct TOKEN_STRUCT);
}

token_T* token_init(hb_string_T value, const token_type_T type, lexer_T* lexer) {
  token_T* token = calloc(1, token_sizeof());

  if (type == TOKEN_NEWLINE) {
    lexer->current_line++;
    lexer->current_column = 0;
  }

  token->value = value;

  token->type = type;
  token->range = (range_T) { .from = lexer->previous_position, .to = lexer->current_position };

  location_from(
    &token->location,
    lexer->previous_line,
    lexer->previous_column,
    lexer->current_line,
    lexer->current_column
  );

  lexer->previous_line = lexer->current_line;
  lexer->previous_column = lexer->current_column;
  lexer->previous_position = lexer->current_position;

  return token;
}

hb_string_T token_type_to_string(const token_type_T type) {
  switch (type) {
    case TOKEN_WHITESPACE: return hb_string("TOKEN_WHITESPACE");
    case TOKEN_NBSP: return hb_string("TOKEN_NBSP");
    case TOKEN_NEWLINE: return hb_string("TOKEN_NEWLINE");
    case TOKEN_IDENTIFIER: return hb_string("TOKEN_IDENTIFIER");
    case TOKEN_HTML_DOCTYPE: return hb_string("TOKEN_HTML_DOCTYPE");
    case TOKEN_XML_DECLARATION: return hb_string("TOKEN_XML_DECLARATION");
    case TOKEN_XML_DECLARATION_END: return hb_string("TOKEN_XML_DECLARATION_END");
    case TOKEN_CDATA_START: return hb_string("TOKEN_CDATA_START");
    case TOKEN_CDATA_END: return hb_string("TOKEN_CDATA_END");
    case TOKEN_HTML_TAG_START: return hb_string("TOKEN_HTML_TAG_START");
    case TOKEN_HTML_TAG_END: return hb_string("TOKEN_HTML_TAG_END");
    case TOKEN_HTML_TAG_START_CLOSE: return hb_string("TOKEN_HTML_TAG_START_CLOSE");
    case TOKEN_HTML_TAG_SELF_CLOSE: return hb_string("TOKEN_HTML_TAG_SELF_CLOSE");
    case TOKEN_HTML_COMMENT_START: return hb_string("TOKEN_HTML_COMMENT_START");
    case TOKEN_HTML_COMMENT_END: return hb_string("TOKEN_HTML_COMMENT_END");
    case TOKEN_EQUALS: return hb_string("TOKEN_EQUALS");
    case TOKEN_QUOTE: return hb_string("TOKEN_QUOTE");
    case TOKEN_BACKTICK: return hb_string("TOKEN_BACKTICK");
    case TOKEN_BACKSLASH: return hb_string("TOKEN_BACKSLASH");
    case TOKEN_DASH: return hb_string("TOKEN_DASH");
    case TOKEN_UNDERSCORE: return hb_string("TOKEN_UNDERSCORE");
    case TOKEN_EXCLAMATION: return hb_string("TOKEN_EXCLAMATION");
    case TOKEN_SLASH: return hb_string("TOKEN_SLASH");
    case TOKEN_SEMICOLON: return hb_string("TOKEN_SEMICOLON");
    case TOKEN_COLON: return hb_string("TOKEN_COLON");
    case TOKEN_AT: return hb_string("TOKEN_AT");
    case TOKEN_LT: return hb_string("TOKEN_LT");
    case TOKEN_PERCENT: return hb_string("TOKEN_PERCENT");
    case TOKEN_AMPERSAND: return hb_string("TOKEN_AMPERSAND");
    case TOKEN_ERB_START: return hb_string("TOKEN_ERB_START");
    case TOKEN_ERB_CONTENT: return hb_string("TOKEN_ERB_CONTENT");
    case TOKEN_ERB_END: return hb_string("TOKEN_ERB_END");
    case TOKEN_CHARACTER: return hb_string("TOKEN_CHARACTER");
    case TOKEN_ERROR: return hb_string("TOKEN_ERROR");
    case TOKEN_EOF: return hb_string("TOKEN_EOF");
  }

  return hb_string("Unknown token_type_T");
}

char* token_to_string(const token_T* token) {
  hb_string_T type_string = token_type_to_string(token->type);
  hb_string_T template = hb_string("#<Herb::Token type=\"%.*s\" value=\"%.*s\" range=[%u, %u] start=(%u:%u) end=(%u:%u)>");

  char* string = calloc(template.length + type_string.length  + token->value.length + 16, sizeof(char));
  hb_string_T escaped;

  if (token->type == TOKEN_EOF) {
    escaped = hb_string(herb_strdup("<EOF>"));
  } else {
    escaped = escape_newlines(token_value(token));
  }

  sprintf(
    string,
    template.data,
    type_string.length,
    type_string.data,
    escaped.length,
    escaped.data,
    token->range.from,
    token->range.to,
    token->location.start.line,
    token->location.start.column,
    token->location.end.line,
    token->location.end.column
  );

  free(escaped.data);

  return string;
}

hb_string_T token_value(const token_T* token) {
  return token->value;
}

int token_type(const token_T* token) {
  return token->type;
}

token_T* token_copy(token_T* token) {
  if (!token) { return NULL; }

  token_T* new_token = calloc(1, token_sizeof());

  if (!new_token) { return NULL; }

  new_token->value = token->value;

  new_token->type = token->type;
  new_token->range = token->range;
  new_token->location = token->location;

  return new_token;
}

// TODO: Remove method
void token_free(token_T* token) {
  if (!token) { return; }

  free(token);
}
