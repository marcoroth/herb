#include "include/location.h"
#include "include/position.h"

void location_from(
  location_T* location,
  uint32_t start_line,
  uint32_t start_column,
  uint32_t end_line,
  uint32_t end_column
) {
  location->start = (position_T) { .line = start_line, .column = start_column };
  location->end = (position_T) { .line = end_line, .column = end_column };
}

void location_from_positions(location_T* location, position_T start, position_T end) {
  location->start = start;
  location->end = end;
}

location_T* location_create(position_T start, position_T end) {
  location_T* location = malloc(sizeof(location_T));

  if (location != NULL) {
    location->start = start;
    location->end = end;
  }

  return location;
}
