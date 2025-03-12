#include "include/range.h"

size_t range_sizeof(void) {
  return sizeof(range_T);
}

range_T* range_init(const size_t from, const size_t to) {
  range_T* range = calloc(1, range_sizeof());

  range->from = from;
  range->to = to;

  return range;
}

size_t range_from(const range_T* range) {
  return range->from;
}

size_t range_to(const range_T* range) {
  return range->to;
}

size_t range_length(range_T* range) {
  return range_to(range) - range_from(range);
}

range_T* range_copy(range_T* range) {
  if (!range) { return NULL; }

  return range_init(range_from(range), range_to(range));
}

void range_free(range_T* range) {
  if (range == NULL) { return; }

  free(range);
}
