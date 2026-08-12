#ifndef HERB_RANGE_H
#define HERB_RANGE_H

#include <stdint.h>
#include <stdlib.h>

typedef struct RANGE_STRUCT {
  uint32_t from;
  uint32_t to;
} range_T;

uint32_t range_length(range_T range);

#endif
