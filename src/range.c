#include "include/range.h"

size_t range_sizeof(void) {
  return sizeof(range_T);
}

range_T* range_init(const size_t start, const size_t end) {
  range_T* range = calloc(1, range_sizeof());

  range->start = start;
  range->end = end;

  return range;
}

size_t range_start(const range_T* range) {
  return range->start;
}

size_t range_end(const range_T* range) {
  return range->end;
}

size_t range_length(range_T* range) {
  return range_end(range) - range_start(range);
}

range_T* range_copy(range_T* range) {
  if (!range) { return NULL; }

  return range_init(range_start(range), range_end(range));
}

void range_free(range_T* range) {
  if (range == NULL) { return; }

  free(range);
}
