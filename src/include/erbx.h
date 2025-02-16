#ifndef ERBX_H
#define ERBX_H

#include "array.h"
#include "ast_node.h"
#include "buffer.h"
#include "extract.h"

void erbx_lex_to_buffer(char* source, buffer_T* output);
array_T* erbx_lex(char* source);
array_T* erbx_lex_file(const char* path);
AST_NODE_T* erbx_parse(char* source);
const char* erbx_version(void);
void erbx_free_tokens(array_T** tokens);

#endif
