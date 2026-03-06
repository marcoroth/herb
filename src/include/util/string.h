#ifndef HERB_UTILS_STRING_H
#define HERB_UTILS_STRING_H

#include <stdbool.h>
#include <string.h>

static inline bool string_equals(const char* a, const char* b) {
  return strcmp(a, b) == 0;
}

#endif
