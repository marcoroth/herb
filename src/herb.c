#include "include/herb.h"
#include "include/array.h"
#include "include/buffer.h"
#include "include/io.h"
#include "include/json.h"
#include "include/lexer.h"
#include "include/parser.h"
#include "include/token.h"
#include "include/version.h"

#include <prism.h>
#include <stdlib.h>

array_T* herb_lex(const char* source) {
  lexer_T lexer = { 0 };
  lexer_init(&lexer, source);

  token_T* token = NULL;
  array_T* tokens = array_init(128);

  while ((token = lexer_next_token(&lexer))->type != TOKEN_EOF) {
    array_append(tokens, token);
  }

  array_append(tokens, token);

  return tokens;
}

AST_DOCUMENT_NODE_T* herb_parse(const char* source, parser_options_T* options) {
  lexer_T* lexer = lexer_init(source);
  parser_T* parser = herb_parser_init(&lexer, options);

  AST_DOCUMENT_NODE_T* document = herb_parser_parse(parser);

  parser_free(parser);

  return document;
}

array_T* herb_lex_file(const char* path) {
  char* source = herb_read_file(path);
  array_T* tokens = herb_lex(source);

  free(source);

  return tokens;
}

void herb_lex_to_buffer(const char* source, buffer_T* output) {
  array_T* tokens = herb_lex(source);

  for (size_t i = 0; i < array_size(tokens); i++) {
    token_T* token = array_get(tokens, i);

    char* type = token_to_string(token);
    buffer_append(output, type);
    free(type);

    buffer_append(output, "\n");
  }

  herb_free_tokens(&tokens);
}

void herb_lex_json_to_buffer(const char* source, buffer_T* output) {
  array_T* tokens = herb_lex(source);

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
  herb_free_tokens(&tokens);
}

void herb_free_tokens(array_T** tokens) {
  if (!tokens || !*tokens) { return; }

  for (size_t i = 0; i < array_size(*tokens); i++) {
    token_T* token = array_get(*tokens, i);
    if (token) { token_free(token); }
  }

  array_free(tokens);
}

const char* herb_version(void) {
  return HERB_VERSION;
}

const char* herb_prism_version(void) {
  return PRISM_VERSION;
}
