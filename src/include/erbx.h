#ifndef ERBX_H
#define ERBX_H

#include "buffer.h"

void erbx_compile(char* source, buffer* output);
void erbx_compile_file(const char* filename, buffer* output);

#endif
