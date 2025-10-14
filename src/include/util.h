#ifndef HERB_UTIL_H
#define HERB_UTIL_H

#include <stdbool.h>
#include <stdlib.h>

int is_newline(int character);

char* escape_newlines(const char* input);
char* quoted_string(const char* input);
char* wrap_string(const char* input, char character);
char* herb_strdup(const char* s);

char* size_t_to_string(size_t value);

#endif
