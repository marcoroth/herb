#ifndef HERB_RANGE_H
#define HERB_RANGE_H

#include <stdlib.h>

typedef struct RANGE_STRUCT {
  size_t from;
  size_t to;
} range_T;

range_T* range_init(size_t from, size_t to);

size_t range_from(const range_T* range);
size_t range_to(const range_T* range);
size_t range_length(range_T* range);

range_T* range_copy(range_T* range);

size_t range_sizeof(void);

void range_free(range_T* range);

#endif
