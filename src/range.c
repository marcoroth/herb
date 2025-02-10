#include "include/range.h"

size_t range_sizeof(void) { return sizeof(range_T); }

range_T *range_init(int start, int end) {
  range_T *range = calloc(1, range_sizeof());

  range->start = start;
  range->end = end;

  return range;
}

int range_start(range_T *range) { return range->start; }

int range_end(range_T *range) { return range->end; }
