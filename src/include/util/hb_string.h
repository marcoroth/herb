#ifndef HERB_STRING_H
#define HERB_STRING_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include <strings.h>

#include "hb_allocator.h"
#include "hb_foreach.h"

typedef struct HB_STRING_STRUCT {
  char* data;
  uint32_t length;
} hb_string_T;

#define HB_STRING_EMPTY ((hb_string_T) { .data = "", .length = 0 })
#define HB_STRING_NULL ((hb_string_T) { .data = NULL, .length = 0 })

#define HB_STRING_LITERAL(string) { .data = (char*) (string), .length = (uint32_t) (sizeof(string) - 1) }

#define HB_STRING_LIST(...) { HB_FOR_EACH(HB_STRING_LITERAL, __VA_ARGS__) }

#define hb_string(string)                                                                                              \
  (__builtin_constant_p(string)                                                                                        \
     ? ((hb_string_T) { .data = (char*) (string), .length = (uint32_t) __builtin_strlen(string) })                     \
     : hb_string_from_c_string(string))

hb_string_T hb_string_from_c_string(const char* null_terminated_c_string);

static inline bool hb_string_is_null(hb_string_T string) {
  return string.data == NULL;
}

static inline bool hb_string_is_empty(hb_string_T string) {
  return string.data == NULL || string.length == 0;
}

static inline hb_string_T hb_string_slice(hb_string_T string, uint32_t offset) {
  if (string.length < offset) { return HB_STRING_NULL; }

  return (hb_string_T) { .data = string.data + offset, .length = string.length - offset };
}

static inline bool hb_string_equals(hb_string_T a, hb_string_T b) {
  if (a.length != b.length) { return false; }

  return strncmp(a.data, b.data, a.length) == 0;
}

static inline bool hb_string_equals_case_insensitive(hb_string_T a, hb_string_T b) {
  if (a.length != b.length) { return false; }

  return strncasecmp(a.data, b.data, a.length) == 0;
}

static inline bool hb_string_starts_with(hb_string_T string, hb_string_T expected_prefix) {
  if (hb_string_is_empty(string) || hb_string_is_empty(expected_prefix)) { return false; }
  if (string.length < expected_prefix.length) { return false; }

  return strncmp(string.data, expected_prefix.data, expected_prefix.length) == 0;
}

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
