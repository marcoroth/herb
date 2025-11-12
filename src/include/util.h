#ifndef HERB_UTIL_H
#define HERB_UTIL_H

#include "util/hb_string.h"
#include <stdbool.h>
#include <stdlib.h>

int is_newline(int character);

hb_string_T escape_newlines(hb_string_T input);
hb_string_T quoted_string(hb_string_T input);
char* herb_strdup(const char* s);

#endif
