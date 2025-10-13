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
