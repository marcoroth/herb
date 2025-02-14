#ifndef ERBX_H
#define ERBX_H

#include "array.h"
#include "buffer.h"
#include "extract.h"

#include <stdint.h>

void erbx_lex_to_buffer(char* source, buffer_T* output);
array_T* erbx_lex(char* source);
array_T* erbx_lex_file(const char* path);
const char* erbx_version(void);
void erbx_free_tokens(array_T** tokens);

#endif
