#include "include/util.h"
#include "include/macros.h"

#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int is_whitespace(int character) {
  return character == ' ' || character == '\t';
}

int is_newline(int character) {
  return character == 13 || character == 10;
}

int count_in_string(const char* string, char character) {
  int count = 0;

  while (*string != '\0') {
    if (*string == character) {
      count++;
    }

    string++;
  }

  return count;
}

int count_newlines(const char* string) {
  return count_in_string(string, '\n');
}

char* replace_char(char* string, char find, char replace) {
  while (*string != '\0') {
    if (*string == find) {
      *string = replace;
    }

    string++;
  }

  return string;
}

char* escape_newlines(const char* input) {
  char* output = (char*) calloc(strlen(input) * 2 + 1, sizeof(char));
  char* orig_output = output;

  while (*input) {
    if (*input == '\n') {
      *output++ = '\\';
      *output++ = 'n';
    } else {
      *output++ = *input;
    }

    input++;
  }

  *output = '\0';

  return orig_output;
}
