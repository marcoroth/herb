#ifndef ERBX_H
#define ERBX_H

#include "buffer.h"
#include "array.h"

void erbx_parse(const uint8_t *source, size_t length);
void erbx_lex_to_buffer(char* source, buffer_T* output);
array_T* erbx_lex(char* source);
array_T* erbx_lex_file(const char* path);
const char* erbx_version(void);

#endif
