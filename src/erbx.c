#include "include/erbx.h"
#include "include/io.h"
#include "include/lexer.h"
#include "include/parser.h"
#include "include/buffer.h"

#include <stdlib.h>

void erbx_compile(char* source, buffer* output) {
  lexer_T* lexer = init_lexer(source);
  token_T* token = 0;

  init_buffer(output);

  while ((token = lexer_next_token(lexer))->type != TOKEN_EOF) {
    buffer_append(output, token_to_string(token));
    buffer_append(output, "\n");
  }

  buffer_append(output, token_to_string(token));
  buffer_append(output, "\n");

  // parser_T* parser = init_parser(lexer);
  // AST_T* root = parser_parse(parser);
  // printf("%zu\n", root->children->size);
}

void erbx_compile_file(const char* filename, buffer* output) {
  char* source = erbx_read_file(filename);
  erbx_compile(source, output);
  free(source);
}
