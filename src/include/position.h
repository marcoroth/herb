#ifndef HERB_POSITION_H
#define HERB_POSITION_H

#include <stdlib.h>

typedef struct POSITION_STRUCT {
  size_t line;
  size_t column;
} position_T;

position_T* position_init(size_t line, size_t column);

size_t position_line(const position_T* position);
size_t position_column(const position_T* position);

size_t position_sizeof(void);

position_T* position_copy(position_T* position);

void position_free(position_T* position);

#endif
