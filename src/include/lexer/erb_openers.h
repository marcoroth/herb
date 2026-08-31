#ifndef HERB_ERB_OPENERS_H
#define HERB_ERB_OPENERS_H

#include "../lib/hb_string.h"

#include <stdbool.h>
#include <stddef.h>

typedef struct ERB_OPENERS_STRUCT {
  const hb_string_T* items;
  size_t count;
} erb_openers_T;

extern const hb_string_T HERB_DEFAULT_ERB_OPENINGS[];
extern const size_t HERB_DEFAULT_ERB_OPENINGS_COUNT;

static inline bool erb_opening_is_default(hb_string_T opening) {
  for (size_t index = 0; index < HERB_DEFAULT_ERB_OPENINGS_COUNT; index++) {
    if (hb_string_equals(opening, HERB_DEFAULT_ERB_OPENINGS[index])) { return true; }
  }

  return false;
}

static inline bool erb_opening_is_custom(hb_string_T opening) {
  return hb_string_starts_with(opening, hb_string("<%")) && !erb_opening_is_default(opening);
}

#endif
