#ifndef ERBX_LOCATION_H
#define ERBX_LOCATION_H

#include <stdlib.h>

typedef struct LOCATION_STRUCT {
  size_t line;
  size_t column;
} location_T;

location_T* location_init(size_t line, size_t column);

size_t location_line(location_T* location);
size_t location_column(location_T* location);

size_t location_sizeof(void);

location_T* location_clone(location_T* location);

void location_free(location_T* location);

#endif
