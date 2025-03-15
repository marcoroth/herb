#ifndef HERB_UTIL_H
#define HERB_UTIL_H

#include <stdbool.h>
#include <stdlib.h>

int is_whitespace(int character);
int is_newline(int character);

int count_in_string(const char* string, char character);
int count_newlines(const char* string);

char* replace_char(char* string, char find, char replace);
char* escape_newlines(const char* input);
char* quoted_string(const char* input);
char* wrap_string(const char* input, char character);

bool string_blank(const char* input);
bool string_present(const char* input);

char* herb_strdup(const char* s);

char* size_t_to_string(size_t value);

#endif
