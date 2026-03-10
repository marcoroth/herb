#ifndef HERB_UTIL_H
#define HERB_UTIL_H

#include "util/hb_string.h"
#include <stdbool.h>
#include <stdlib.h>

struct hb_allocator;

int is_newline(int character);
int is_whitespace(int character);
hb_string_T escape_newlines(struct hb_allocator* allocator, hb_string_T input);
hb_string_T quoted_string(struct hb_allocator* allocator, hb_string_T input);

char* convert_underscores_to_dashes(const char* input);

#endif
