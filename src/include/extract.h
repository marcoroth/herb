#ifndef HERB_EXTRACT_H
#define HERB_EXTRACT_H

#include "lib/hb_allocator.h"
#include "lib/hb_buffer.h"

#include <stdbool.h>

typedef enum {
  HERB_EXTRACT_LANGUAGE_RUBY,
  HERB_EXTRACT_LANGUAGE_HTML,
} herb_extract_language_T;

typedef struct {
  bool semicolons;
  bool comments;
  bool preserve_positions;
} herb_extract_ruby_options_T;

extern const herb_extract_ruby_options_T HERB_EXTRACT_RUBY_DEFAULT_OPTIONS;

void herb_extract_ruby_to_buffer_with_options(
  const char* source,
  hb_buffer_T* output,
  const herb_extract_ruby_options_T* options,
  hb_allocator_T* allocator
);
void herb_extract_ruby_to_buffer(const char* source, hb_buffer_T* output, hb_allocator_T* allocator);
void herb_extract_html_to_buffer(const char* source, hb_buffer_T* output, hb_allocator_T* allocator);

char* herb_extract_ruby_with_semicolons(const char* source, hb_allocator_T* allocator);

char* herb_extract(const char* source, herb_extract_language_T language, hb_allocator_T* allocator);

#endif
