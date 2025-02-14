#ifndef ERBX_UTIL_H
#define ERBX_UTIL_H

#include <stdlib.h>

int is_whitespace(int character);
int is_newline(int character);

int count_in_string(const char* string, char character);
int count_newlines(const char* string);

char* replace_char(char* string, char find, char replace);
char* escape_newlines(const char* input);

#endif
