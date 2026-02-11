#ifndef HERB_UTIL_H
#define HERB_UTIL_H

#include "util/hb_string.h"
#include <stdbool.h>
#include <stdlib.h>

int is_newline(int character);
int is_whitespace(int character);
const char* skip_whitespace(const char* ptr);

hb_string_T escape_newlines(hb_string_T input);
hb_string_T quoted_string(hb_string_T input);
char* herb_strdup(const char* s);

#endif
