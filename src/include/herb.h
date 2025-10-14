#ifndef HERB_H
#define HERB_H

#include "ast_node.h"
#include "extract.h"
#include "parser.h"
#include "util/hb_array.h"
#include "util/hb_buffer.h"

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

void herb_lex_to_buffer(const char* source, hb_buffer_T* output);

hb_array_T* herb_lex(const char* source);
hb_array_T* herb_lex_file(const char* path);

AST_DOCUMENT_NODE_T* herb_parse(const char* source, parser_options_T* options);

const char* herb_version(void);
const char* herb_prism_version(void);

void herb_free_tokens(hb_array_T** tokens);

#ifdef __cplusplus
}
#endif

#endif
