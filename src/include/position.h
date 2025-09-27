#ifndef HERB_POSITION_H
#define HERB_POSITION_H

#include <stdint.h>
#include <stdlib.h>

typedef struct POSITION_STRUCT {
  uint32_t line;
  uint32_t column;
} position_T;

position_T* position_init(uint32_t line, uint32_t column);

size_t position_sizeof(void);

position_T* position_copy(position_T* position);

#endif
