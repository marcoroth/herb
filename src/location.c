#include "include/location.h"

size_t location_sizeof(void) {
  return sizeof(location_T);
}

location_T* location_init(int line, int column) {
  location_T* location = (location_T*) malloc(location_sizeof());
  location->line = line;
  location->column = column;

  return location;
}

int location_line(location_T* location) {
  return location->line;
}

int location_column(location_T* location) {
  return location->column;
}

void location_free(location_T* location) {
  free(location);
}
