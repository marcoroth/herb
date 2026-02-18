#include "include/herb.h"
#include "include/analyze.h"
#include "include/io.h"
#include "include/lexer.h"
#include "include/macros.h"
#include "include/parser.h"
#include "include/token.h"
#include "include/util/hb_arena.h"
#include "include/util/hb_array.h"
#include "include/util/hb_buffer.h"
#include "include/version.h"

#include <prism.h>
#include <stdlib.h>

HERB_EXPORTED_FUNCTION herb_lex_result_T* herb_lex(const char* source, hb_arena_T* arena) {
  if (!arena) { return NULL; }

  lexer_T lexer = { 0 };
  lexer_init(&lexer, source, arena);

  token_T* token = NULL;
  hb_array_T* tokens = hb_array_init(128);

  while ((token = lexer_next_token(&lexer))->type != TOKEN_EOF) {
    hb_array_append(tokens, token);
  }

  hb_array_append(tokens, token);

  herb_lex_result_T* result = malloc(sizeof(herb_lex_result_T));
  if (!result) {
    hb_array_free(&tokens);
    return NULL;
  }

  result->tokens = tokens;
  result->arena = arena;

  return result;
}

HERB_EXPORTED_FUNCTION AST_DOCUMENT_NODE_T* herb_parse(
  const char* source,
  const parser_options_T* options,
  hb_arena_T* arena
) {
  if (!source) { source = ""; }
  if (!arena) { return NULL; }

  lexer_T lexer = { 0 };
  lexer_init(&lexer, source, arena);
  parser_T parser = { 0 };

  parser_options_T parser_options = HERB_DEFAULT_PARSER_OPTIONS;

  if (options != NULL) { parser_options = *options; }

  herb_parser_init(&parser, &lexer, parser_options);

  AST_DOCUMENT_NODE_T* document = herb_parser_parse(&parser);

  herb_parser_deinit(&parser);

  if (parser_options.analyze) { herb_analyze_parse_tree(document, source, parser_options.strict); }

  return document;
}

HERB_EXPORTED_FUNCTION herb_lex_result_T* herb_lex_file(const char* path, hb_arena_T* arena) {
  char* source = herb_read_file(path);
  herb_lex_result_T* result = herb_lex(source, arena);

  free(source);

  return result;
}

HERB_EXPORTED_FUNCTION void herb_lex_to_buffer(const char* source, hb_buffer_T* output) {
  hb_arena_T* arena = malloc(sizeof(hb_arena_T));
  if (!arena) { return; }

  if (!hb_arena_init(arena, KB(512))) {
    free(arena);
    return;
  }

  herb_lex_result_T* result = herb_lex(source, arena);

  if (!result) {
    hb_arena_free(arena);
    free(arena);
    return;
  }

  for (size_t i = 0; i < hb_array_size(result->tokens); i++) {
    token_T* token = hb_array_get(result->tokens, i);

    hb_string_T type = token_to_string(token);
    hb_buffer_append_string(output, type);
    free(type.data);

    hb_buffer_append(output, "\n");
  }

  herb_free_lex_result(&result);
}

void herb_free_lex_result(herb_lex_result_T** result) {
  if (!result || !*result) { return; }

  herb_lex_result_T* r = *result;

  if (r->tokens) { hb_array_free(&r->tokens); }

  if (r->arena) {
    hb_arena_free(r->arena);
    free(r->arena);
  }

  free(r);
  *result = NULL;
}

HERB_EXPORTED_FUNCTION void herb_free_tokens(hb_array_T** tokens) {
  if (!tokens || !*tokens) { return; }

  for (size_t i = 0; i < hb_array_size(*tokens); i++) {
    token_T* token = hb_array_get(*tokens, i);
    if (token) { token_free(token); }
  }

  hb_array_free(tokens);
}

HERB_EXPORTED_FUNCTION const char* herb_version(void) {
  return HERB_VERSION;
}

HERB_EXPORTED_FUNCTION const char* herb_prism_version(void) {
  return PRISM_VERSION;
}
