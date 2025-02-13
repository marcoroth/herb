#ifndef ERBX_RANGE_H
#define ERBX_RANGE_H

#include <stdlib.h>

typedef struct RANGE_STRUCT {
  int start;
  int end;
} range_T;

range_T* range_init(int start, int end);

int range_length(range_T* range);
int range_start(range_T* range);
int range_end(range_T* range);

size_t range_sizeof(void);

#endif
