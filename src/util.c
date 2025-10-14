#include "include/util.h"
#include "include/util/hb_buffer.h"

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int is_newline(const int character) {
  return character == 13 || character == 10;
}

char* escape_newlines(const char* input) {
  hb_buffer_T buffer;

  hb_buffer_init(&buffer, strlen(input));

  for (size_t i = 0; i < strlen(input); ++i) {
    switch (input[i]) {
      case '\n': {
        hb_buffer_append_char(&buffer, '\\');
        hb_buffer_append_char(&buffer, 'n');
      } break;
      case '\r': {
        hb_buffer_append_char(&buffer, '\\');
        hb_buffer_append_char(&buffer, 'r');
      } break;
      default: {
        hb_buffer_append_char(&buffer, input[i]);
      }
    }
  }

  return buffer.value;
}

char* wrap_string(const char* input, const char character) {
  if (input == NULL) { return NULL; }

  hb_buffer_T buffer;

  hb_buffer_init(&buffer, strlen(input) + 2);

  hb_buffer_append_char(&buffer, character);
  hb_buffer_append(&buffer, input);
  hb_buffer_append_char(&buffer, character);

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
