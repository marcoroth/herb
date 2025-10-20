#ifndef HERB_STRING_H
#define HERB_STRING_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "../hb_arena.h"

typedef struct HB_STRING_STRUCT {
  char* data;
  uint32_t length;
} hb_string_T;

hb_string_T hb_string(const char* null_terminated_c_string);
hb_string_T hb_string_slice(hb_string_T string, uint32_t offset);
bool hb_string_equals(hb_string_T a, hb_string_T b);
bool hb_string_equals_case_insensitive(hb_string_T a, hb_string_T b);
bool hb_string_starts_with(hb_string_T string, hb_string_T expected_prefix);
bool hb_string_is_empty(hb_string_T string);

char* hb_string_to_c_string(hb_arena_T* allocator, hb_string_T string);

#endif
