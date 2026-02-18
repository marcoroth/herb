#ifndef HERB_H
#define HERB_H

#include "ast_node.h"
#include "extract.h"
#include "macros.h"
#include "parser.h"
#include "util/hb_arena.h"
#include "util/hb_array.h"
#include "util/hb_buffer.h"

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
  hb_array_T* tokens;
  hb_arena_T* arena;
} herb_lex_result_T;

HERB_EXPORTED_FUNCTION void herb_lex_to_buffer(const char* source, hb_buffer_T* output);

HERB_EXPORTED_FUNCTION herb_lex_result_T* herb_lex(const char* source, hb_arena_T* arena);
HERB_EXPORTED_FUNCTION herb_lex_result_T* herb_lex_file(const char* path, hb_arena_T* arena);

HERB_EXPORTED_FUNCTION AST_DOCUMENT_NODE_T* herb_parse(
  const char* source,
  const parser_options_T* options,
  hb_arena_T* arena
);

HERB_EXPORTED_FUNCTION const char* herb_version(void);
HERB_EXPORTED_FUNCTION const char* herb_prism_version(void);

void herb_free_lex_result(herb_lex_result_T** result);
HERB_EXPORTED_FUNCTION void herb_free_tokens(hb_array_T** tokens);

#ifdef __cplusplus
}
#endif

#endif
