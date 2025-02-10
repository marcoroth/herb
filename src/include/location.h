#ifndef ERBX_LOCATION_H
#define ERBX_LOCATION_H

#include <stdlib.h>

typedef struct LOCATION_STRUCT {
  int line;
  int column;
} location_T;

location_T *location_init(int line, int column);

int location_line(location_T *location);
int location_column(location_T *location);

size_t location_sizeof(void);

void location_free(location_T *location);

#endif
