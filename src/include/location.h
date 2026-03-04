#ifndef HERB_LOCATION_H
#define HERB_LOCATION_H

#include <stdint.h>
#include <stdlib.h>

#include "position.h"

typedef struct LOCATION_STRUCT {
  position_T start;
  position_T end;
} location_T;

void location_from(
  location_T* location,
  uint32_t start_line,
  uint32_t start_column,
  uint32_t end_line,
  uint32_t end_column
);

void location_from_positions(location_T* location, position_T start, position_T end);

location_T* location_create(position_T start, position_T end);

#endif
