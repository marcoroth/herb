#ifndef ERBX_H
#define ERBX_H

#include "buffer.h"

void erbx_compile(char* source, buffer_T* output);
void erbx_compile_file(const char* filename, buffer_T* output);
const char * erbx_version(void);

#endif
