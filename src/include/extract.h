#ifndef ERBX_EXTRACT_H
#define ERBX_EXTRACT_H

#include "buffer.h"

typedef enum {
  ERBX_EXTRACT_LANGUAGE_RUBY,
  ERBX_EXTRACT_LANGUAGE_HTML,
} erbx_extract_language_T;

void erbx_extract_ruby_to_buffer(char* source, buffer_T* output);
void erbx_extract_html_to_buffer(char* source, buffer_T* output);

char* erbx_extract(char* source, erbx_extract_language_T language);
char* erbx_extract_from_file(const char* path, erbx_extract_language_T language);

#endif
