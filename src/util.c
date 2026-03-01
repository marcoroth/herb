#include "include/util.h"
#include "include/util/hb_buffer.h"
#include "include/util/hb_string.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int is_newline(int character) {
  return character == '\n' || character == '\r';
}

int is_whitespace(int character) {
  return character == ' ' || character == '\t' || character == '\n' || character == '\r';
}

const char* skip_whitespace(const char* pointer) {
  while (is_whitespace(*pointer)) {
    pointer++;
  }

  return pointer;
}

hb_string_T escape_newlines(hb_string_T input) {
  hb_buffer_T buffer;

  hb_buffer_init(&buffer, input.length);

  for (size_t i = 0; i < input.length; ++i) {
    switch (input.data[i]) {
      case '\n': {
        hb_buffer_append_char(&buffer, '\\');
        hb_buffer_append_char(&buffer, 'n');
      } break;
      case '\r': {
        hb_buffer_append_char(&buffer, '\\');
        hb_buffer_append_char(&buffer, 'r');
      } break;
      default: {
        hb_buffer_append_char(&buffer, input.data[i]);
      }
    }
  }

  return hb_string(buffer.value);
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
