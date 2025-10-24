#include "include/util.h"
#include "include/util/hb_buffer.h"
#include "include/util/hb_string.h"

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int is_newline(int character) {
  return character == '\n' || character == '\r';
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

static hb_string_T wrap_string(hb_string_T input, char character) {
  hb_buffer_T buffer;

  hb_buffer_init(&buffer, input.length + 2);

  hb_buffer_append_char(&buffer, character);
  hb_buffer_append_string(&buffer, input);
  hb_buffer_append_char(&buffer, character);

  return hb_string(buffer.value);
}

hb_string_T quoted_string(hb_string_T input) {
  return wrap_string(input, '"');
}

char* herb_strdup(const char* s) {
  size_t len = strlen(s) + 1;
  char* copy = malloc(len);

  if (copy) { memcpy(copy, s, len); }

  return copy;
}
