#ifndef HERB_EXTRACT_H
#define HERB_EXTRACT_H

#include "buffer.h"

typedef enum {
  HERB_EXTRACT_LANGUAGE_RUBY,
  HERB_EXTRACT_LANGUAGE_HTML,
} herb_extract_language_T;

void herb_extract_ruby_to_buffer(const char* source, buffer_T* output);
void herb_extract_html_to_buffer(const char* source, buffer_T* output);

char* herb_extract_ruby_with_semicolons(const char* source);
void herb_extract_ruby_to_buffer_with_semicolons(const char* source, buffer_T* output);

char* herb_extract(const char* source, herb_extract_language_T language);
char* herb_extract_from_file(const char* path, herb_extract_language_T language);

#endif
