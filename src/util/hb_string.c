#include "../include/util/hb_string.h"
#include "../include/macros.h"
#include "../include/util.h"

#include <stdlib.h>
#include <string.h>
#include <strings.h>

hb_string_T hb_string_from_c_string(const char* null_terminated_c_string) {
  if (null_terminated_c_string == NULL) { return HB_STRING_NULL; }

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

bool hb_string_is_null(hb_string_T string) {
  return string.data == NULL;
}

bool hb_string_is_empty(hb_string_T string) {
  return string.data == NULL || string.length == 0;
}

hb_string_T hb_string_truncate(hb_string_T string, uint32_t max_length) {
  hb_string_T truncated_string = { .data = string.data, .length = MIN(string.length, max_length) };

  return truncated_string;
}

hb_string_T hb_string_range(hb_string_T string, uint32_t from, uint32_t to) {
  return hb_string_truncate(hb_string_slice(string, from), to - from);
}

hb_string_T hb_string_trim_start(hb_string_T string) {
  if (hb_string_is_empty(string)) { return string; }

  uint32_t offset = 0;
  while (offset < string.length && is_whitespace(string.data[offset])) {
    offset++;
  }

  return hb_string_slice(string, offset);
}

hb_string_T hb_string_trim_end(hb_string_T string) {
  if (hb_string_is_empty(string)) { return string; }

  uint32_t length = string.length;
  while (length > 0 && is_whitespace(string.data[length - 1])) {
    length--;
  }

  return hb_string_truncate(string, length);
}

hb_string_T hb_string_trim(hb_string_T string) {
  return hb_string_trim_end(hb_string_trim_start(string));
}

bool hb_string_is_blank(hb_string_T string) {
  if (hb_string_is_empty(string)) { return true; }

  for (uint32_t i = 0; i < string.length; i++) {
    if (!is_whitespace(string.data[i])) { return false; }
  }

  return true;
}

hb_string_T hb_string_copy(hb_string_T string, hb_allocator_T* allocator) {
  if (hb_string_is_null(string)) { return HB_STRING_NULL; }
  if (hb_string_is_empty(string)) { return HB_STRING_EMPTY; }

  char* copy = hb_allocator_strndup(allocator, string.data, string.length);

  return (hb_string_T) { .data = copy, .length = string.length };
}

char* hb_string_to_c_string_using_malloc(hb_string_T string) {
  if (hb_string_is_null(string)) { return NULL; }

  size_t length = string.length;
  char* buffer = malloc(length + 1);

  if (!buffer) { return NULL; }

  if (length > 0) { memcpy(buffer, string.data, length); }

  buffer[length] = '\0';

  return buffer;
}

char* hb_string_to_c_string(hb_arena_T* allocator, hb_string_T string) {
  size_t string_length_in_bytes = sizeof(char) * (string.length);
  char* buffer = hb_arena_alloc(allocator, string_length_in_bytes + sizeof(char) * 1);

  if (!hb_string_is_empty(string)) { memcpy(buffer, string.data, string_length_in_bytes); }

  buffer[string_length_in_bytes] = '\0';

  return buffer;
}
