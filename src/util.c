#include "include/util.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int is_whitespace(const int character) {
  return character == ' ' || character == '\t';
}

int is_newline(const int character) {
  return character == 13 || character == 10;
}

int count_in_string(const char* string, const char character) {
  int count = 0;

  while (*string != '\0') {
    if (*string == character) { count++; }

    string++;
  }

  return count;
}

int count_newlines(const char* string) {
  int count = 0;

  while (*string) {
    if (*string == '\r') {
      count++;
      if (*(string + 1) == '\n') { string++; }
    } else if (*string == '\n') {
      count++;
    }

    string++;
  }

  return count;
}

char* replace_char(char* string, const char find, const char replace) {
  while (*string != '\0') {
    if (*string == find) { *string = replace; }

    string++;
  }

  return string;
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

char* erbx_strdup(const char* s) {
  size_t len = strlen(s) + 1;
  char* copy = malloc(len);

  if (copy) { memcpy(copy, s, len); }

  return copy;
}
