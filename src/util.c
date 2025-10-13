#include "include/util.h"
#include "include/buffer.h"

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int is_newline(const int character) {
  return character == 13 || character == 10;
}

char* escape_newlines(const char* input) {
  buffer_T buffer;

  buffer_init(&buffer, strlen(input));

  for (size_t i = 0; i < strlen(input); ++i) {
    switch (input[i]) {
      case '\n': {
        buffer_append_char(&buffer, '\\');
        buffer_append_char(&buffer, 'n');
      } break;
      case '\r': {
        buffer_append_char(&buffer, '\\');
        buffer_append_char(&buffer, 'r');
      } break;
      default: {
        buffer_append_char(&buffer, input[i]);
      }
    }
  }

  return buffer.value;
}

char* wrap_string(const char* input, const char character) {
  if (input == NULL) { return NULL; }

  buffer_T buffer;

  buffer_init(&buffer, strlen(input) + 2);

  buffer_append_char(&buffer, character);
  buffer_append(&buffer, input);
  buffer_append_char(&buffer, character);

  return buffer.value;
}

char* quoted_string(const char* input) {
  return wrap_string(input, '"');
}

char* herb_strdup(const char* s) {
  size_t len = strlen(s) + 1;
  char* copy = malloc(len);

  if (copy) { memcpy(copy, s, len); }

  return copy;
}

char* size_t_to_string(const size_t value) {
  char* buffer = malloc(21);
  snprintf(buffer, 21, "%zu", value);

  return buffer;
}
