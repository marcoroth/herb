#include "include/token.h"
#include "include/lexer.h"
#include "include/position.h"
#include "include/range.h"
#include "include/token_struct.h"
#include "include/util.h"

#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

size_t token_sizeof(void) {
  return sizeof(struct TOKEN_STRUCT);
}

token_T* token_init(hb_string_T value, const token_type_T type, lexer_T* lexer) {
  token_T* token = hb_arena_alloc(lexer->arena, token_sizeof());

  if (type == TOKEN_NEWLINE) {
    lexer->current_line++;
    lexer->current_column = 0;
  }

  if (value.data) {
    char* arena_value = hb_arena_alloc(lexer->arena, value.length + 1);
    if (arena_value) {
      memcpy(arena_value, value.data, value.length);
      arena_value[value.length] = '\0';
      token->value = arena_value;
    } else {
      token->value = NULL;
    }
  } else {
    token->value = NULL;
  }

  token->type = type;
  token->arena_allocated = true;
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

  return "Unknown token_type_T";
}

hb_string_T token_to_string(const token_T* token) {
  const char* type_string = token_type_to_string(token->type);
  const char* template = "#<Herb::Token type=\"%s\" value=\"%.*s\" range=[%u, %u] start=(%u:%u) end=(%u:%u)>";

  char* string = calloc(strlen(type_string) + strlen(template) + strlen(token->value) + 16, sizeof(char));
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

token_T* token_copy(token_T* token, hb_arena_T* arena) {
  if (!token) { return NULL; }

  token_T* new_token = arena ? hb_arena_alloc(arena, token_sizeof()) : calloc(1, token_sizeof());

  if (!new_token) { return NULL; }

  if (token->value) {
    if (arena) {
      size_t value_length = strlen(token->value);
      char* arena_value = hb_arena_alloc(arena, value_length + 1);

      if (arena_value) {
        memcpy(arena_value, token->value, value_length);
        arena_value[value_length] = '\0';
        new_token->value = arena_value;
      } else {
        new_token->value = NULL;
      }
    } else {
      new_token->value = herb_strdup(token->value);

      if (!new_token->value) {
        free(new_token);
        return NULL;
      }
    }
  } else {
    new_token->value = NULL;
  }

  new_token->type = token->type;
  new_token->range = token->range;
  new_token->location = token->location;
  new_token->arena_allocated = arena != NULL;

  return new_token;
}

bool token_value_empty(const token_T* token) {
  return token == NULL || token->value == NULL || token->value[0] == '\0';
}

void token_free(token_T* token) {
  if (!token) { return; }

  if (!token->arena_allocated) {
    if (token->value != NULL) { free(token->value); }

    free(token);
  }
}
