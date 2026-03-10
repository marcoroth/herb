#ifndef HERB_H
#define HERB_H

#include "array.h"
#include "ast_node.h"
#include "buffer.h"
#include "extract.h"
#include "parser.h"

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

void herb_lex_to_buffer(const char* source, buffer_T* output);
void herb_lex_json_to_buffer(const char* source, buffer_T* output);

array_T* herb_lex(const char* source);
array_T* herb_lex_file(const char* path);

AST_DOCUMENT_NODE_T* herb_parse(const char* source, parser_options_T* options);

const char* herb_version(void);
const char* herb_prism_version(void);

void herb_free_tokens(array_T** tokens);

#ifdef __cplusplus
}
#endif

#endif
