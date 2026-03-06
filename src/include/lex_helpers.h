#ifndef HERB_LEX_HELPERS_H
#define HERB_LEX_HELPERS_H

#include "herb.h"
#include "token.h"
#include "util/hb_allocator.h"
#include "util/hb_array.h"
#include "util/hb_buffer.h"
#include "util/hb_string.h"

#include <stdlib.h>

static inline void herb_lex_to_buffer(const char* source, hb_buffer_T* output, hb_allocator_T* allocator) {
  hb_array_T* tokens = herb_lex(source, allocator);

  for (size_t i = 0; i < hb_array_size(tokens); i++) {
    token_T* token = hb_array_get(tokens, i);

    hb_string_T type = token_to_string(token);
    hb_buffer_append_string(output, type);
    free(type.data);

    hb_buffer_append(output, "\n");
  }

  herb_free_tokens(&tokens, allocator);
}

#endif
