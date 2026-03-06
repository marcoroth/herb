#ifndef HERB_STRING_H
#define HERB_STRING_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "hb_allocator.h"

typedef struct HB_STRING_STRUCT {
  char* data;
  uint32_t length;
} hb_string_T;

#define HB_STRING_EMPTY ((hb_string_T){ .data = "", .length = 0 })
#define HB_STRING_NULL  ((hb_string_T){ .data = NULL, .length = 0 })

hb_string_T hb_string(const char* null_terminated_c_string);
hb_string_T hb_string_slice(hb_string_T string, uint32_t offset);

bool hb_string_equals(hb_string_T a, hb_string_T b);
bool hb_string_equals_case_insensitive(hb_string_T a, hb_string_T b);
bool hb_string_starts_with(hb_string_T string, hb_string_T expected_prefix);
bool hb_string_is_null(hb_string_T string);
bool hb_string_is_empty(hb_string_T string);

hb_string_T hb_string_truncate(hb_string_T string, uint32_t max_length);
hb_string_T hb_string_range(hb_string_T string, uint32_t from, uint32_t to);
hb_string_T hb_string_trim_start(hb_string_T string);
hb_string_T hb_string_trim_end(hb_string_T string);
hb_string_T hb_string_trim(hb_string_T string);
bool hb_string_is_blank(hb_string_T string);
hb_string_T hb_string_copy(hb_string_T string, hb_allocator_T* allocator);

char* hb_string_to_c_string_using_malloc(hb_string_T string);
char* hb_string_to_c_string(hb_arena_T* allocator, hb_string_T string);

#endif
