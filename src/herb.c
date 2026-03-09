#include "include/herb.h"
#include "include/analyze/analyze.h"
#include "include/analyze/prism_annotate.h"
#include "include/lexer.h"
#include "include/parser.h"
#include "include/token.h"
#include "include/util/hb_allocator.h"
#include "include/util/hb_array.h"
#include "include/version.h"

#include <prism.h>
#include <stdlib.h>

HERB_EXPORTED_FUNCTION hb_array_T* herb_lex(const char* source, hb_allocator_T* allocator) {
  if (!source) { source = ""; }

  lexer_T lexer = { 0 };
  lexer_init(&lexer, source, allocator);

  token_T* token = NULL;
  hb_array_T* tokens = hb_array_init(128, allocator);

  while ((token = lexer_next_token(&lexer))->type != TOKEN_EOF) {
    hb_array_append(tokens, token);
  }

  hb_array_append(tokens, token);

  return tokens;
}

HERB_EXPORTED_FUNCTION AST_DOCUMENT_NODE_T* herb_parse(
  const char* source,
  const parser_options_T* options,
  hb_allocator_T* allocator
) {
  if (!source) { source = ""; }

  lexer_T lexer = { 0 };
  lexer_init(&lexer, source, allocator);
  parser_T parser = { 0 };

  parser_options_T parser_options = HERB_DEFAULT_PARSER_OPTIONS;
  if (options != NULL) { parser_options = *options; }

  herb_parser_init(&parser, &lexer, parser_options);

  AST_DOCUMENT_NODE_T* document = herb_parser_parse(&parser);

  herb_parser_deinit(&parser);

  if (parser_options.analyze) { herb_analyze_parse_tree(document, source, &parser_options, allocator); }

  if (parser_options.prism_nodes || parser_options.prism_program) {
    herb_annotate_prism_nodes(
      document,
      source,
      parser_options.prism_nodes,
      parser_options.prism_nodes_deep,
      parser_options.prism_program,
      allocator
    );
  }

  return document;
}

HERB_EXPORTED_FUNCTION void herb_free_tokens(hb_array_T** tokens, hb_allocator_T* allocator) {
  if (!tokens || !*tokens) { return; }

  for (size_t i = 0; i < hb_array_size(*tokens); i++) {
    token_T* token = hb_array_get(*tokens, i);
    if (token) { token_free(token, allocator); }
  }

  hb_array_free(tokens);
}

HERB_EXPORTED_FUNCTION const char* herb_version(void) {
  return HERB_VERSION;
}

HERB_EXPORTED_FUNCTION const char* herb_prism_version(void) {
  return PRISM_VERSION;
}
