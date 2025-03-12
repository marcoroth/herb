#ifndef HERB_H
#define HERB_H

#include "array.h"
#include "ast_node.h"
#include "buffer.h"
#include "extract.h"

#include <stdint.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

#ifdef __cplusplus
extern "C" {
#endif

EMSCRIPTEN_KEEPALIVE void herb_lex_to_buffer(const char* source, buffer_T* output);
EMSCRIPTEN_KEEPALIVE void herb_lex_json_to_buffer(const char* source, buffer_T* output);
EMSCRIPTEN_KEEPALIVE array_T* herb_lex(const char* source);
EMSCRIPTEN_KEEPALIVE array_T* herb_lex_file(const char* path);
EMSCRIPTEN_KEEPALIVE AST_DOCUMENT_NODE_T* herb_parse(const char* source);
EMSCRIPTEN_KEEPALIVE const char* herb_version(void);
EMSCRIPTEN_KEEPALIVE void herb_free_tokens(array_T** tokens);

#ifdef __cplusplus
}
#endif

#endif
