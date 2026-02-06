#ifndef HERB_STR_UTILS_H
#define HERB_STR_UTILS_H

#include <stdbool.h>
#include <string.h>

static inline bool string_eq(const char* a, const char* b) {
  return strcmp(a, b) == 0;
}

#endif
