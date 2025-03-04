#ifndef ERBX_RANGE_H
#define ERBX_RANGE_H

#include <stdlib.h>

typedef struct RANGE_STRUCT {
  size_t start;
  size_t end;
} range_T;

range_T* range_init(size_t start, size_t end);

size_t range_start(const range_T* range);
size_t range_end(const range_T* range);
size_t range_length(range_T* range);

range_T* range_copy(range_T* range);

size_t range_sizeof(void);

void range_free(range_T* range);

#endif
