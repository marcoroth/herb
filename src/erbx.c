#include "include/erbx.h"
#include "include/array.h"
#include "include/buffer.h"
#include "include/io.h"
#include "include/lexer.h"
#include "include/parser.h"
#include "include/token.h"
#include "include/version.h"

#include <stdlib.h>

array_T *erbx_lex(char *source) {
  lexer_T *lexer = lexer_init(source);
  token_T *token = 0;

  array_T *tokens = array_init(1);

  while ((token = lexer_next_token(lexer))->type != TOKEN_EOF) {
    array_append(tokens, token);
  }

  array_append(tokens, token);

  return tokens;
}

array_T *erbx_lex_file(const char *path) {
  char *source = erbx_read_file(path);
  array_T *tokens = erbx_lex(source);

  free(source);

  return tokens;
}

void erbx_lex_to_buffer(char *source, buffer_T *output) {
  array_T *tokens = erbx_lex(source);

  for (int i = 0; i < array_size(tokens); i++) {
    token_T *token = array_get(tokens, i);
    buffer_append(output, token_to_string(token));
    buffer_append(output, "\n");
  }

  // parser_T* parser = parser_init(lexer);
  // AST_T* root = parser_parse(parser);
  // printf("%zu\n", root->children->size);
}

const char *erbx_version(void) { return ERBX_VERSION; }
