#ifndef HERB_H
#define HERB_H

#include "ast/ast_node.h"
#include "extract.h"
#include "lib/hb_allocator.h"
#include "lib/hb_array.h"
#include "lib/hb_buffer.h"
#include "macros.h"
#include "parser/parser.h"

#include <prism.h>
#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

HERB_EXPORTED_FUNCTION hb_array_T* herb_lex(const char* source, hb_allocator_T* allocator);

HERB_EXPORTED_FUNCTION AST_DOCUMENT_NODE_T* herb_parse(
  const char* source,
  const parser_options_T* options,
  hb_allocator_T* allocator
);

HERB_EXPORTED_FUNCTION const char* herb_version(void);
HERB_EXPORTED_FUNCTION const char* herb_prism_version(void);

typedef struct {
  pm_parser_t parser;
  pm_node_t* root;
  pm_options_t options;
} herb_ruby_parse_result_T;

HERB_EXPORTED_FUNCTION herb_ruby_parse_result_T* herb_parse_ruby(const char* source, size_t length);
HERB_EXPORTED_FUNCTION void herb_free_ruby_parse_result(herb_ruby_parse_result_T* result);
HERB_EXPORTED_FUNCTION void herb_free_tokens(hb_array_T** tokens, hb_allocator_T* allocator);

#ifdef __cplusplus
}
#endif

#endif
