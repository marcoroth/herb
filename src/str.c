#include "include/str.h"

#include <stdlib.h>
#include <string.h>
#include <strings.h>

str_T str_from_c_string(const char* null_terminated_c_string) {
  str_T string;

  string.data = (char*) null_terminated_c_string;
  string.length = strlen(null_terminated_c_string);

  return string;
}

bool str_equals(str_T a, str_T b) {
  if (a.length != b.length) { return false; }

  return strncmp(a.data, b.data, a.length) == 0;
}

bool str_equals_case_insensitive(str_T a, str_T b) {
  if (a.length != b.length) { return false; }

  return strncasecmp(a.data, b.data, a.length) == 0;
}

bool str_start_with(str_T string, str_T expected_prefix) {
  if (str_is_empty(string) || str_is_empty(expected_prefix)) { return false; }
  if (string.length < expected_prefix.length) { return false; }

  return strncmp(string.data, expected_prefix.data, expected_prefix.length) == 0;
}

bool str_is_empty(str_T string) {
  return string.length == 0;
}

char* str_to_c_string(str_T string) {
  size_t string_length_in_bytes = sizeof(char) * (string.length);
  char* buffer = malloc(string_length_in_bytes + sizeof(char) * 1);

  memcpy(buffer, string.data, string_length_in_bytes);
  buffer[string_length_in_bytes] = '\0';

  return buffer;
}
