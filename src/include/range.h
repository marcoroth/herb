#ifndef ERBX_RANGE_H
#define ERBX_RANGE_H

#include <stdlib.h>

typedef struct RANGE_STRUCT {
  size_t start;
  size_t end;
} range_T;

range_T* range_init(size_t start, size_t end);

size_t range_start(range_T* range);
size_t range_end(range_T* range);

size_t range_sizeof(void);

#endif
