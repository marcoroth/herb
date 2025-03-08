#ifndef HERB_LOCATION_H
#define HERB_LOCATION_H

#include <stdlib.h>

#include "position.h"

typedef struct LOCATION_STRUCT {
  position_T* start;
  position_T* end;
} location_T;

location_T* location_init(position_T* start, position_T* end);
location_T* location_from(size_t start_line, size_t start_column, size_t end_line, size_t end_column);

position_T* location_start(location_T* location);
position_T* location_end_(location_T* location);

size_t location_sizeof(void);

location_T* location_copy(location_T* location);

void location_free(location_T* location);

#endif
