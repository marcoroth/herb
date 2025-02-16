#include "include/erbx.h"
#include "include/array.h"
#include "include/buffer.h"
#include "include/io.h"
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

  return tokens;
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
    buffer_append(output, token_to_string(token));
    buffer_append(output, "\n");
  }

  erbx_free_tokens(&tokens);

  // parser_T* parser = parser_init(lexer);
  // AST_NODE_T* root = parser_parse(parser);
  // printf("%zu\n", root->children->size);
}

void erbx_free_tokens(array_T** tokens) {
  if (!tokens || !(*tokens)) return;

  for (size_t i = 0; i < array_size(*tokens); i++) {
    token_T* token = array_get(*tokens, i);
    if (token) token_free(token);
  }

  array_free(tokens);
}

const char* erbx_version(void) {
  return ERBX_VERSION;
}
