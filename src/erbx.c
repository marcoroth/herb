#include "include/erbx.h"
#include "include/array.h"
#include "include/buffer.h"
#include "include/io.h"
#include "include/json.h"
#include "include/lexer.h"
#include "include/parser.h"
#include "include/token.h"
#include "include/version.h"

#include <stdlib.h>

bool is_lexer_stuck(lexer_T* lexer, size_t* last_position, size_t* stall_counter, size_t limit) {
  if (*last_position == lexer->current_position) {
    (*stall_counter)++;
    return *stall_counter > limit;
  }

  *stall_counter = 0;
  *last_position = lexer->current_position;

  return false;
}

array_T* erbx_lex(char* source) {
  lexer_T* lexer = lexer_init(source);
  token_T* token = NULL;

  array_T* tokens = array_init(1);

  size_t last_position = lexer->current_position;
  size_t stall_counter = 0;
  const size_t STALL_COUNTER_LIMIT = 5;

  while ((token = lexer_next_token(lexer))->type != TOKEN_EOF) {
    array_append(tokens, token);

    if (is_lexer_stuck(lexer, &last_position, &stall_counter, STALL_COUNTER_LIMIT)) {
      char lex_error[64];
      snprintf(lex_error, sizeof(lex_error), "Lexer stuck: no progress after %zu iterations.", STALL_COUNTER_LIMIT);
      array_append(tokens, lexer_error(lexer, lex_error));
      return tokens;
    }
  }

  array_append(tokens, token);

  lexer_free(lexer);

  return tokens;
}

AST_DOCUMENT_NODE_T* erbx_parse(char* source) {
  lexer_T* lexer = lexer_init(source);
  parser_T* parser = parser_init(lexer);

  AST_DOCUMENT_NODE_T* document = parser_parse(parser);

  parser_free(parser);

  return document;
}

array_T* erbx_lex_file(const char* path) {
  char* source = erbx_read_file(path);
  array_T* tokens = erbx_lex(source);

  free(source);

  return tokens;
}

void erbx_lex_to_buffer(char* source, buffer_T* output) {
  array_T* tokens = erbx_lex(source);

  for (size_t i = 0; i < array_size(tokens); i++) {
    token_T* token = array_get(tokens, i);

    char* type = token_to_string(token);
    buffer_append(output, type);
    free(type);

    buffer_append(output, "\n");
  }

  erbx_free_tokens(&tokens);
}

void erbx_lex_json_to_buffer(char* source, buffer_T* output) {
  array_T* tokens = erbx_lex(source);

  buffer_T json = buffer_new();
  json_start_root_array(&json);

  for (size_t i = 0; i < array_size(tokens); i++) {
    token_T* token = array_get(tokens, i);
    char* token_json = token_to_json(token);
    json_add_raw_string(&json, token_json);
    free(token_json);
  }

  json_end_array(&json);
  buffer_concat(output, &json);

  buffer_free(&json);
  erbx_free_tokens(&tokens);
}

void erbx_free_tokens(array_T** tokens) {
  if (!tokens || !(*tokens)) { return; }

  for (size_t i = 0; i < array_size(*tokens); i++) {
    token_T* token = array_get(*tokens, i);
    if (token) { token_free(token); }
  }

  array_free(tokens);
}

const char* erbx_version(void) {
  return ERBX_VERSION;
}
