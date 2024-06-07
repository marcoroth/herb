#include "include/erbx.h"
#include "include/io.h"
#include "include/lexer.h"
#include "include/parser.h"
#include "include/buffer.h"
#include "include/version.h"

#include <stdlib.h>

void erbx_compile(char* source, buffer_T* output) {
  lexer_T* lexer = lexer_init(source);
  token_T* token = 0;

  buffer_init(output);

  while ((token = lexer_next_token(lexer))->type != TOKEN_EOF) {
    buffer_append(output, token_to_string(token));
    buffer_append(output, "\n");
  }

  buffer_append(output, token_to_string(token));
  buffer_append(output, "\n");

  // parser_T* parser = parser_init(lexer);
  // AST_T* root = parser_parse(parser);
  // printf("%zu\n", root->children->size);
}

void erbx_compile_file(const char* filename, buffer_T* output) {
  char* source = erbx_read_file(filename);
  erbx_compile(source, output);
  free(source);
}

const char* erbx_version(void) {
  return ERBX_VERSION;
}
