#include "include/erbx.h"
#include "include/array.h"
#include "include/buffer.h"
#include "include/io.h"
#include "include/lexer.h"
#include "include/parser.h"
#include "include/token.h"
#include "include/version.h"
#include <prism.h>

#include <stdlib.h>

void erbx_parse(const uint8_t *source, size_t length) {
    pm_parser_t parser;
    pm_parser_init(&parser, source, length, NULL);
 
    pm_node_t *root = pm_parse(&parser);
    const char *hh = pm_token_type_name(root->type);
    pm_buffer_t buffer;
    pm_buffer_init(&buffer);
 
    pm_prettyprint(&buffer, &parser, root);
    printf("%*.s\n", (int) buffer.length, buffer.value);
 
    pm_buffer_free(&buffer);
    pm_node_destroy(&parser, root);
    pm_parser_free(&parser);
}

array_T* erbx_lex(char* source) {
  lexer_T* lexer = lexer_init(source);
  token_T* token = 0;

  array_T* tokens = array_init(1);

  while ((token = lexer_next_token(lexer))->type != TOKEN_EOF) {
    array_append(tokens, token);
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

  for (int i = 0; i < array_size(tokens); i++) {
    token_T* token = array_get(tokens, i);
    buffer_append(output, token_to_string(token));
    buffer_append(output, "\n");
  }

  erbx_free_tokens(&tokens);

  // parser_T* parser = parser_init(lexer);
  // AST_T* root = parser_parse(parser);
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
