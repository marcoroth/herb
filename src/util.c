#include "include/util.h"

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int is_newline(const int character) {
  return character == 13 || character == 10;
}

char* escape_newlines(const char* input) {
  char* output = calloc(strlen(input) * 2 + 1, sizeof(char));
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

char* wrap_string(const char* input, const char character) {
  if (input == NULL) { return NULL; }

  const size_t length = strlen(input);
  char* wrapped = malloc(length + 3);

  if (wrapped == NULL) { return NULL; }

  wrapped[0] = character;
  strcpy(wrapped + 1, input);
  wrapped[length + 1] = character;
  wrapped[length + 2] = '\0';

  return wrapped;
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
