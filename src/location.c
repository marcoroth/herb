#include "include/location.h"
#include "include/memory.h"
#include "include/position.h"

size_t location_sizeof(void) {
  return sizeof(location_T);
}

location_T* location_init(position_T* start, position_T* end) {
  location_T* location = safe_malloc(location_sizeof());

  location->start = start;
  location->end = end;

  return location;
}

location_T* location_from(size_t start_line, size_t start_column, size_t end_line, size_t end_column) {
  return location_init(position_init(start_line, start_column), position_init(end_line, end_column));
}

position_T* location_start(location_T* location) {
  return location->start;
}

position_T* location_end(location_T* location) {
  return location->end;
}

location_T* location_copy(location_T* location) {
  if (location == NULL) { return NULL; }

  return location_init(position_copy(location->start), position_copy(location->end));
}

void location_free(location_T* location) {
  if (location->start != NULL) { position_free(location->start); }
  if (location->end != NULL) { position_free(location->end); }

  free(location);
}
