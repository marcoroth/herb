#include "include/token.h"
#include "include/json.h"
#include "include/lexer.h"
#include "include/location.h"
#include "include/token_struct.h"
#include "include/util.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

size_t token_sizeof(void) {
  return sizeof(struct TOKEN_STRUCT);
}

token_T* token_init(const char* value, token_type_T type, lexer_T* lexer) {
  token_T* token = calloc(1, token_sizeof());

  if (value) {
    token->value = erbx_strdup(value);
  } else {
    token->value = NULL;
  }

  token->type = type;
  token->range = range_init(lexer->current_position - strlen(value), lexer->current_position);

  size_t start_line = lexer->current_line - count_newlines(value);
  size_t start_column = lexer->current_column - strlen(value); // TODO: fix start_column calculation if
                                                               // value contains newlines
  size_t end_line = lexer->current_line;
  size_t end_column = lexer->current_column;

  token->start = location_init(start_line, start_column);
  token->end = location_init(end_line, end_column);

  return token;
}

const char* token_type_to_string(token_type_T type) {
  switch (type) {
    case TOKEN_WHITESPACE: return "TOKEN_WHITESPACE";
    case TOKEN_NBSP: return "TOKEN_NBSP";
    case TOKEN_NEWLINE: return "TOKEN_NEWLINE";
    case TOKEN_IDENTIFIER: return "TOKEN_IDENTIFIER";
    case TOKEN_HTML_DOCTYPE: return "TOKEN_HTML_DOCTYPE";
    case TOKEN_HTML_TAG_START: return "TOKEN_HTML_TAG_START";
    case TOKEN_HTML_TAG_END: return "TOKEN_HTML_TAG_END";
    case TOKEN_HTML_TAG_START_CLOSE: return "TOKEN_HTML_TAG_START_CLOSE";
    case TOKEN_HTML_TAG_SELF_CLOSE: return "TOKEN_HTML_TAG_SELF_CLOSE";
    case TOKEN_HTML_COMMENT_START: return "TOKEN_HTML_COMMENT_START";
    case TOKEN_HTML_COMMENT_END: return "TOKEN_HTML_COMMENT_END";
    case TOKEN_EQUALS: return "TOKEN_EQUALS";
    case TOKEN_QUOTE: return "TOKEN_QUOTE";
    case TOKEN_DASH: return "TOKEN_DASH";
    case TOKEN_UNDERSCORE: return "TOKEN_UNDERSCORE";
    case TOKEN_EXCLAMATION: return "TOKEN_EXCLAMATION";
    case TOKEN_SLASH: return "TOKEN_SLASH";
    case TOKEN_SEMICOLON: return "TOKEN_SEMICOLON";
    case TOKEN_COLON: return "TOKEN_COLON";
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

char* token_to_string(token_T* token) {
  const char* type_string = token_type_to_string(token->type);
  const char* template = "#<Token type=%s value='%s' range=[%d, %d] start=%d:%d end=%d:%d>";

  char* string = calloc(strlen(type_string) + strlen(template) + 8, sizeof(char));

  char* escaped = escape_newlines(token->value);

  sprintf(
    string,
    template,
    type_string,
    escaped,
    token->range->start,
    token->range->end,
    token->start->line,
    token->start->column,
    token->end->line,
    token->end->column
  );

  free(escaped);

  return string;
}

char* token_to_json(token_T* token) {
  buffer_T json = buffer_new();

  json_start_root_object(&json);
  json_add_string(&json, "type", token_type_to_string(token->type));
  json_add_string(&json, "value", token->value);

  buffer_T range = buffer_new();
  json_start_array(&json, "range");
  json_add_size_t(&range, NULL, token->range->start);
  json_add_size_t(&range, NULL, token->range->end);
  buffer_concat(&json, &range);
  json_end_array(&json);

  buffer_T start = buffer_new();
  json_start_object(&json, "start");
  json_add_size_t(&start, "line", token->start->line);
  json_add_size_t(&start, "column", token->start->column);
  buffer_concat(&json, &start);
  json_end_object(&json);

  buffer_T end = buffer_new();
  json_start_object(&json, "end");
  json_add_size_t(&end, "line", token->start->line);
  json_add_size_t(&end, "column", token->start->column);
  buffer_concat(&json, &end);
  json_end_object(&json);

  json_end_object(&json);

  return buffer_value(&json);
}

char* token_value(token_T* token) {
  return token->value;
}

int token_type(token_T* token) {
  return token->type;
}

token_T* token_copy(token_T* token) {
  if (!token) { return NULL; }

  token_T* new_token = calloc(1, token_sizeof());

  if (!new_token) { return NULL; }

  if (token->value) {
    new_token->value = erbx_strdup(token->value);

    if (!new_token->value) {
      free(new_token);
      return NULL;
    }
  } else {
    new_token->value = NULL;
  }

  new_token->type = token->type;
  new_token->range = range_copy(token->range);
  new_token->start = location_copy(token->start);
  new_token->end = location_copy(token->end);

  return new_token;
}

void token_free(token_T* token) {
  if (!token) { return; }

  if (token->value != NULL) { free(token->value); }

  free(token);
}
