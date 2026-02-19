#include "../include/util/hb_string.h"
#include "../include/macros.h"

#include <stdlib.h>
#include <string.h>
#include <strings.h>

hb_string_T hb_string(const char* null_terminated_c_string) {
  hb_string_T string;

  string.data = (char*) null_terminated_c_string;
  string.length = (uint32_t) strlen(null_terminated_c_string);

  return string;
}

hb_string_T hb_string_slice(hb_string_T string, uint32_t offset) {
  hb_string_T slice;
  if (string.length < offset) {
    slice.data = NULL;
    slice.length = 0;

    return slice;
  }

  slice.data = string.data + offset;
  slice.length = string.length - offset;

  return slice;
}

bool hb_string_equals(hb_string_T a, hb_string_T b) {
  if (a.length != b.length) { return false; }

  return strncmp(a.data, b.data, a.length) == 0;
}

bool hb_string_equals_case_insensitive(hb_string_T a, hb_string_T b) {
  if (a.length != b.length) { return false; }

  return strncasecmp(a.data, b.data, a.length) == 0;
}

bool hb_string_starts_with(hb_string_T string, hb_string_T expected_prefix) {
  if (hb_string_is_empty(string) || hb_string_is_empty(expected_prefix)) { return false; }
  if (string.length < expected_prefix.length) { return false; }

  return strncmp(string.data, expected_prefix.data, expected_prefix.length) == 0;
}

bool hb_string_is_empty(hb_string_T string) {
  return string.length == 0;
}

hb_string_T hb_string_truncate(hb_string_T string, uint32_t max_length) {
  hb_string_T truncated_string = { .data = string.data, .length = MIN(string.length, max_length) };

  return truncated_string;
}

hb_string_T hb_string_range(hb_string_T string, uint32_t from, uint32_t to) {
  return hb_string_truncate(hb_string_slice(string, from), to - from);
}

char* hb_string_to_c_string_using_malloc(hb_string_T string) {
  size_t string_length_in_bytes = sizeof(char) * (string.length);
  char* buffer = malloc(string_length_in_bytes + sizeof(char) * 1);

  if (!buffer) { return NULL; }

  if (!hb_string_is_empty(string)) { memcpy(buffer, string.data, string_length_in_bytes); }

  buffer[string_length_in_bytes] = '\0';

  return buffer;
}

char* hb_string_to_c_string(hb_arena_T* allocator, hb_string_T string) {
  size_t string_length_in_bytes = sizeof(char) * (string.length);
  char* buffer = hb_arena_alloc(allocator, string_length_in_bytes + sizeof(char) * 1);

  if (!hb_string_is_empty(string)) { memcpy(buffer, string.data, string_length_in_bytes); }

  buffer[string_length_in_bytes] = '\0';

  return buffer;
}
