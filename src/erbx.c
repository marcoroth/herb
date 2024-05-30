#include "include/erbx.h"
#include "include/io.h"
#include "include/lexer.h"
#include "include/parser.h"

#include <stdlib.h>

void erbx_compile(char* source) {
  lexer_T* lexer = init_lexer(source);
  token_T* token = 0;

  while ((token = lexer_next_token(lexer))->type != TOKEN_EOF) {
    printf("%s\n", token_to_string(token));
  }
  printf("%s\n", token_to_string(token));

  // parser_T* parser = init_parser(lexer);
  // AST_T* root = parser_parse(parser);
  // printf("%zu\n", root->children->size);
}

void erbx_compile_file(const char* filename) {
  char* source = erbx_read_file(filename);
  erbx_compile(source);
  free(source);
}
