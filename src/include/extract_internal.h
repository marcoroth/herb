#ifndef HERB_EXTRACT_INTERNAL_H
#define HERB_EXTRACT_INTERNAL_H

#include "extract.h"

void herb_extract_ruby_to_buffer_with_options_preserving_bytes(
  const char* source,
  hb_buffer_T* output,
  const herb_extract_ruby_options_T* options,
  hb_allocator_T* allocator
);

#endif
