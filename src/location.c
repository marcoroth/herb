#include "include/location.h"
#include "include/memory.h"

size_t location_sizeof(void) {
  return sizeof(location_T);
}

location_T* location_init(size_t line, size_t column) {
  location_T* location = safe_malloc(sizeof(location_T));
  location->line = line;
  location->column = column;

  return location;
}

size_t location_line(location_T* location) {
  return location->line;
}

size_t location_column(location_T* location) {
  return location->column;
}

void location_free(location_T* location) {
  free(location);
}
