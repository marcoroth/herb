#include "include/util.h"
#include "include/memory_arena.h"

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int is_whitespace(const int character) {
  return character == ' ' || character == '\t';
}

int is_newline(const int character) {
  return character == 13 || character == 10;
}

char* escape_newlines(arena_allocator_T* allocator, const char* input) {
  char* output = arena_alloc(allocator, strlen(input) * 2 + 1 * sizeof(char));
  char* orig_output = output;

  while (*input) {
    if (*input == '\n') {
      *output++ = '\\';
      *output++ = 'n';
    } else if (*input == '\r') {
      *output++ = '\\';
      *output++ = 'r';
    } else {
      *output++ = *input;
    }

    input++;
  }

  *output = '\0';

  return orig_output;
}

char* wrap_string(arena_allocator_T* allocator, const char* input, const char character) {
  if (input == NULL) { return NULL; }

  const size_t length = strlen(input);
  char* wrapped = arena_alloc(allocator, length + 3);

  if (wrapped == NULL) { return NULL; }

  wrapped[0] = character;
  strcpy(wrapped + 1, input);
  wrapped[length + 1] = character;
  wrapped[length + 2] = '\0';

  return wrapped;
}

char* quoted_string(arena_allocator_T* allocator, const char* input) {
  return wrap_string(allocator, input, '"');
}

// Check if a string is blank (NULL, empty, or only contains whitespace)
bool string_blank(const char* input) {
  if (input == NULL || input[0] == '\0') { return true; }

  for (const char* p = input; *p != '\0'; p++) {
    if (!isspace(*p)) { return false; }
  }

  return true;
}

// Check if a string is present (not blank)
bool string_present(const char* input) {
  return !string_blank(input);
}

char* herb_strdup(arena_allocator_T* allocator, const char* s) {
  size_t len = strlen(s) + 1;
  char* copy = arena_alloc(allocator, len);

  if (copy) { memcpy(copy, s, len); }

  return copy;
}

char* size_t_to_string(arena_allocator_T* allocator, const size_t value) {
  char* buffer = arena_alloc(allocator, 21);
  snprintf(buffer, 21, "%zu", value);

  return buffer;
}
