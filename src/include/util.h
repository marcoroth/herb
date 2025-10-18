#ifndef HERB_UTIL_H
#define HERB_UTIL_H

#include <stdbool.h>
#include <stdlib.h>

int is_newline(int character);

char* escape_newlines(const char* input);
char* quoted_string(const char* input);
char* herb_strdup(const char* s);

#endif
