#ifndef ERBX_EXTRACT_H
#define ERBX_EXTRACT_H

#include "array.h"
#include "buffer.h"

void erbx_extract_ruby_to_buffer(char* source, buffer_T* output);
char* erbx_extract_ruby(char* source);
char* erbx_extract_ruby_from_file(const char* path);

void erbx_extract_html_to_buffer(char* source, buffer_T* output);
char* erbx_extract_html(char* source);
char* erbx_extract_html_from_file(const char* path);

#endif
