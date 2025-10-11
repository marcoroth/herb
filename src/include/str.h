#ifndef HERB_STR_H
#define HERB_STR_H

#include <stdbool.h>
#include <stddef.h>

typedef struct STR_STRUCT {
  char* data;
  size_t length;
} str_T;

str_T str_from_c_string(const char* null_terminated_c_string);
bool str_equals(str_T a, str_T b);
bool str_equals_case_insensitive(str_T a, str_T b);
bool str_start_with(str_T string, str_T expected_prefix);
bool str_is_empty(str_T string);

// Allocates a null terminated c string with the contents of the passed string
// it's your responsibility to free it.
char* str_to_c_string(str_T string);

#endif
