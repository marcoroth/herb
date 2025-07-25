#include "include/token.h"
#include "include/json.h"
#include "include/lexer.h"
#include "include/position.h"
#include "include/token_struct.h"
#include "include/util.h"

#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

size_t token_sizeof(void) {
  return sizeof(struct TOKEN_STRUCT);
}

token_T* token_init(const char* value, const token_type_T type, lexer_T* lexer) {
  token_T* token = calloc(1, token_sizeof());

  if (type == TOKEN_NEWLINE) {
    lexer->current_line++;
    lexer->current_column = 0;
  }

  if (value) {
    token->value = herb_strdup(value);
  } else {
    token->value = NULL;
  }

  token->type = type;
  token->range = range_init(lexer->previous_position, lexer->current_position);

  token->location =
    location_from(lexer->previous_line, lexer->previous_column, lexer->current_line, lexer->current_column);

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

const char* token_type_to_friendly_string(const token_type_T type) {
  switch (type) {
    case TOKEN_WHITESPACE: return "whitespace";
    case TOKEN_NBSP: return "non-breaking space";
    case TOKEN_NEWLINE: return "newline";
    case TOKEN_IDENTIFIER: return "identifier";
    case TOKEN_HTML_DOCTYPE: return "<!DOCTYPE";
    case TOKEN_HTML_TAG_START: return "<";
    case TOKEN_HTML_TAG_END: return ">";
    case TOKEN_HTML_TAG_START_CLOSE: return "</";
    case TOKEN_HTML_TAG_SELF_CLOSE: return "/>";
    case TOKEN_HTML_COMMENT_START: return "<!--";
    case TOKEN_HTML_COMMENT_END: return "-->";
    case TOKEN_EQUALS: return "=";
    case TOKEN_QUOTE: return "quote";
    case TOKEN_DASH: return "-";
    case TOKEN_UNDERSCORE: return "_";
    case TOKEN_EXCLAMATION: return "!";
    case TOKEN_SLASH: return "/";
    case TOKEN_SEMICOLON: return ";";
    case TOKEN_COLON: return ":";
    case TOKEN_LT: return "<";
    case TOKEN_PERCENT: return "%";
    case TOKEN_AMPERSAND: return "&";
    case TOKEN_ERB_START: return "ERB start";
    case TOKEN_ERB_CONTENT: return "ERB content";
    case TOKEN_ERB_END: return "ERB end";
    case TOKEN_CHARACTER: return "character";
    case TOKEN_ERROR: return "error";
    case TOKEN_EOF: return "end of file";
  }

  return "unknown token";
}

char* token_types_to_friendly_string_va(token_type_T first_token, ...) {
  // Count tokens
  va_list args;
  va_start(args, first_token);

  size_t count = 0;
  token_type_T current = first_token;

  // First pass: count tokens
  while (current != TOKEN_SENTINEL) {
    count++;
    current = va_arg(args, token_type_T);
  }
  va_end(args);

  if (count == 0) { return herb_strdup(""); }

  // Calculate total length needed
  va_start(args, first_token);
  size_t total_length = 0;
  current = first_token;
  size_t i = 0;

  while (current != TOKEN_SENTINEL) {
    const char* friendly_name = token_type_to_friendly_string(current);
    total_length += strlen(friendly_name) + 2; // +2 for backticks

    if (i < count - 1 && count > 1) {
      if (i == count - 2) {
        total_length += 4; // " or "
      } else {
        total_length += 2; // ", "
      }
    }

    current = va_arg(args, token_type_T);
    i++;
  }
  va_end(args);

  total_length += 1; // null terminator

  // Allocate buffer
  char* result = calloc(total_length, sizeof(char));
  if (!result) { return NULL; }

  // Build the string
  va_start(args, first_token);
  current = first_token;
  size_t pos = 0;
  i = 0;

  while (current != TOKEN_SENTINEL) {
    const char* friendly_name = token_type_to_friendly_string(current);

    // Add backtick before token name
    result[pos++] = '`';

    // Add token name
    strcpy(result + pos, friendly_name);
    pos += strlen(friendly_name);

    // Add backtick after token name
    result[pos++] = '`';

    // Add separator
    if (count > 2 && i < count - 2) {
      strcpy(result + pos, ", ");
      pos += 2;
    } else if (count > 1 && i == count - 2) {
      strcpy(result + pos, " or ");
      pos += 4;
    }

    current = va_arg(args, token_type_T);
    i++;
  }

  va_end(args);
  return result;
}

char* token_to_string(const token_T* token) {
  const char* type_string = token_type_to_string(token->type);
  const char* template = "#<Herb::Token type=\"%s\" value=\"%s\" range=[%d, %d] start=(%d:%d) end=(%d:%d)>";

  char* string = calloc(strlen(type_string) + strlen(template) + strlen(token->value) + 16, sizeof(char));
  char* escaped;

  if (token->type == TOKEN_EOF) {
    escaped = herb_strdup("<EOF>");
  } else {
    escaped = escape_newlines(token->value);
  }

  sprintf(
    string,
    template,
    type_string,
    escaped,
    token->range->from,
    token->range->to,
    token->location->start->line,
    token->location->start->column,
    token->location->end->line,
    token->location->end->column
  );

  free(escaped);

  return string;
}

char* token_to_json(const token_T* token) {
  buffer_T json = buffer_new();

  json_start_root_object(&json);
  json_add_string(&json, "type", token_type_to_string(token->type));
  json_add_string(&json, "value", token->value);

  buffer_T range = buffer_new();
  json_start_array(&json, "range");
  json_add_size_t(&range, NULL, token->range->from);
  json_add_size_t(&range, NULL, token->range->to);
  buffer_concat(&json, &range);
  buffer_free(&range);
  json_end_array(&json);

  buffer_T start = buffer_new();
  json_start_object(&json, "start");
  json_add_size_t(&start, "line", token->location->start->line);
  json_add_size_t(&start, "column", token->location->start->column);
  buffer_concat(&json, &start);
  buffer_free(&start);
  json_end_object(&json);

  buffer_T end = buffer_new();
  json_start_object(&json, "end");
  json_add_size_t(&end, "line", token->location->end->line);
  json_add_size_t(&end, "column", token->location->end->column);
  buffer_concat(&json, &end);
  buffer_free(&end);
  json_end_object(&json);

  json_end_object(&json);

  return buffer_value(&json);
}

char* token_value(const token_T* token) {
  return token->value;
}

int token_type(const token_T* token) {
  return token->type;
}

position_T* token_start_position(token_T* token) {
  return token->location->start;
}

position_T* token_end_position(token_T* token) {
  return token->location->end;
}

token_T* token_copy(token_T* token) {
  if (!token) { return NULL; }

  token_T* new_token = calloc(1, token_sizeof());

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
  new_token->range = range_copy(token->range);
  new_token->location = location_copy(token->location);

  return new_token;
}

void token_free(token_T* token) {
  if (!token) { return; }

  if (token->value != NULL) { free(token->value); }
  if (token->range != NULL) { range_free(token->range); }
  if (token->location != NULL) { location_free(token->location); }

  free(token);
}
