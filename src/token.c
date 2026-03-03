#include "include/token.h"
#include "include/position.h"
#include "include/range.h"
#include "include/token_struct.h"
#include "include/util.h"
#include "include/util/hb_buffer.h"

#include <stdarg.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

token_T* token_init(hb_string_T value, const token_type_T type, lexer_T* lexer) {
  token_T* token = calloc(1, sizeof(token_T));

  if (!token) { return NULL; }

  if (type == TOKEN_NEWLINE) {
    lexer->current_line++;
    lexer->current_column = 0;
  }

  token->value = hb_string_to_c_string_using_malloc(value);

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

const char* token_type_to_string(const token_type_T type) {
  switch (type) {
    case TOKEN_WHITESPACE: return "TOKEN_WHITESPACE";
    case TOKEN_NBSP: return "TOKEN_NBSP";
    case TOKEN_NEWLINE: return "TOKEN_NEWLINE";
    case TOKEN_IDENTIFIER: return "TOKEN_IDENTIFIER";
    case TOKEN_HTML_DOCTYPE: return "TOKEN_HTML_DOCTYPE";
    case TOKEN_XML_DECLARATION: return "TOKEN_XML_DECLARATION";
    case TOKEN_XML_DECLARATION_END: return "TOKEN_XML_DECLARATION_END";
    case TOKEN_CDATA_START: return "TOKEN_CDATA_START";
    case TOKEN_CDATA_END: return "TOKEN_CDATA_END";
    case TOKEN_HTML_TAG_START: return "TOKEN_HTML_TAG_START";
    case TOKEN_HTML_TAG_END: return "TOKEN_HTML_TAG_END";
    case TOKEN_HTML_TAG_START_CLOSE: return "TOKEN_HTML_TAG_START_CLOSE";
    case TOKEN_HTML_TAG_SELF_CLOSE: return "TOKEN_HTML_TAG_SELF_CLOSE";
    case TOKEN_HTML_COMMENT_START: return "TOKEN_HTML_COMMENT_START";
    case TOKEN_HTML_COMMENT_END: return "TOKEN_HTML_COMMENT_END";
    case TOKEN_HTML_COMMENT_INVALID_END: return "TOKEN_HTML_COMMENT_INVALID_END";
    case TOKEN_EQUALS: return "TOKEN_EQUALS";
    case TOKEN_QUOTE: return "TOKEN_QUOTE";
    case TOKEN_BACKTICK: return "TOKEN_BACKTICK";
    case TOKEN_BACKSLASH: return "TOKEN_BACKSLASH";
    case TOKEN_DASH: return "TOKEN_DASH";
    case TOKEN_UNDERSCORE: return "TOKEN_UNDERSCORE";
    case TOKEN_EXCLAMATION: return "TOKEN_EXCLAMATION";
    case TOKEN_SLASH: return "TOKEN_SLASH";
    case TOKEN_SEMICOLON: return "TOKEN_SEMICOLON";
    case TOKEN_COLON: return "TOKEN_COLON";
    case TOKEN_AT: return "TOKEN_AT";
    case TOKEN_LT: return "TOKEN_LT";
    case TOKEN_PERCENT: return "TOKEN_PERCENT";
    case TOKEN_AMPERSAND: return "TOKEN_AMPERSAND";
    case TOKEN_ERB_START: return "TOKEN_ERB_START";
    case TOKEN_ERB_CONTENT: return "TOKEN_ERB_CONTENT";
    case TOKEN_ERB_END: return "TOKEN_ERB_END";
    case TOKEN_CHARACTER: return "TOKEN_CHARACTER";
    case TOKEN_ERROR: return "TOKEN_ERROR";
    case TOKEN_EOF: return "TOKEN_EOF";
  }
}

const char* token_type_to_friendly_string(const token_type_T type) {
  switch (type) {
    case TOKEN_WHITESPACE: return "whitespace";
    case TOKEN_NBSP: return "non-breaking space";
    case TOKEN_NEWLINE: return "a newline";
    case TOKEN_IDENTIFIER: return "an identifier";
    case TOKEN_HTML_DOCTYPE: return "`<!DOCTYPE`";
    case TOKEN_XML_DECLARATION: return "`<?xml`";
    case TOKEN_XML_DECLARATION_END: return "`?>`";
    case TOKEN_CDATA_START: return "`<![CDATA[`";
    case TOKEN_CDATA_END: return "`]]>`";
    case TOKEN_HTML_TAG_START: return "`<`";
    case TOKEN_HTML_TAG_END: return "`>`";
    case TOKEN_HTML_TAG_START_CLOSE: return "`</`";
    case TOKEN_HTML_TAG_SELF_CLOSE: return "`/>`";
    case TOKEN_HTML_COMMENT_START: return "`<!--`";
    case TOKEN_HTML_COMMENT_END: return "`-->`";
    case TOKEN_HTML_COMMENT_INVALID_END: return "`--!>`";
    case TOKEN_EQUALS: return "`=`";
    case TOKEN_QUOTE: return "a quote";
    case TOKEN_BACKTICK: return "a backtick";
    case TOKEN_BACKSLASH: return "`\\`";
    case TOKEN_DASH: return "`-`";
    case TOKEN_UNDERSCORE: return "`_`";
    case TOKEN_EXCLAMATION: return "`!`";
    case TOKEN_SLASH: return "`/`";
    case TOKEN_SEMICOLON: return "`;`";
    case TOKEN_COLON: return "`:`";
    case TOKEN_AT: return "`@`";
    case TOKEN_LT: return "`<`";
    case TOKEN_PERCENT: return "`%`";
    case TOKEN_AMPERSAND: return "`&`";
    case TOKEN_ERB_START: return "`<%`";
    case TOKEN_ERB_CONTENT: return "ERB content";
    case TOKEN_ERB_END: return "`%>`";
    case TOKEN_CHARACTER: return "a character";
    case TOKEN_ERROR: return "an error token";
    case TOKEN_EOF: return "end of file";
  }
}

char* token_types_to_friendly_string_valist(token_type_T first_token, va_list args) {
  if ((int) first_token == TOKEN_SENTINEL) { return herb_strdup(""); }

  size_t count = 0;
  const char* names[32];
  token_type_T current = first_token;

  while ((int) current != TOKEN_SENTINEL && count < 32) {
    names[count++] = token_type_to_friendly_string(current);
    current = va_arg(args, token_type_T);
  }

  hb_buffer_T buffer;
  hb_buffer_init(&buffer, 128);

  for (size_t i = 0; i < count; i++) {
    hb_buffer_append(&buffer, names[i]);

    if (i < count - 1) {
      if (count > 2) { hb_buffer_append(&buffer, ", "); }
      if (i == count - 2) { hb_buffer_append(&buffer, count == 2 ? " or " : "or "); }
    }
  }

  return hb_buffer_value(&buffer);
}

char* token_types_to_friendly_string_va(token_type_T first_token, ...) {
  va_list args;
  va_start(args, first_token);
  char* result = token_types_to_friendly_string_valist(first_token, args);
  va_end(args);
  return result;
}

hb_string_T token_to_string(const token_T* token) {
  const char* type_string = token_type_to_string(token->type);
  const char* template = "#<Herb::Token type=\"%s\" value=\"%.*s\" range=[%u, %u] start=(%u:%u) end=(%u:%u)>";
  const char* value = token->value ? token->value : "";

  char* string = calloc(strlen(type_string) + strlen(template) + strlen(value) + 16, sizeof(char));

  if (!string) { return hb_string(""); }

  hb_string_T escaped;

  if (token->type == TOKEN_EOF) {
    escaped = hb_string(herb_strdup("<EOF>"));
  } else {
    escaped = escape_newlines(hb_string(token->value));
  }

  sprintf(
    string,
    template,
    type_string,
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

  return hb_string(string);
}

token_T* token_copy(token_T* token) {
  if (!token) { return NULL; }

  token_T* new_token = calloc(1, sizeof(token_T));

  if (!new_token) { return NULL; }

  if (token->value) {
    new_token->value = herb_strdup(token->value);

    if (!new_token->value) {
      free(new_token);
      return NULL;
    }
  } else {
    new_token->value = NULL;
  }

  new_token->type = token->type;
  new_token->range = token->range;
  new_token->location = token->location;

  return new_token;
}

bool token_value_empty(const token_T* token) {
  return token == NULL || token->value == NULL || token->value[0] == '\0';
}

void token_free(token_T* token) {
  if (!token) { return; }

  if (token->value != NULL) { free(token->value); }

  free(token);
}
