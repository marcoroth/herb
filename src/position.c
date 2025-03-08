#include "include/position.h"
#include "include/memory.h"

size_t position_sizeof(void) {
  return sizeof(position_T);
}

position_T* position_init(const size_t line, const size_t column) {
  position_T* position = safe_malloc(position_sizeof());

  position->line = line;
  position->column = column;

  return position;
}

size_t position_line(const position_T* position) {
  return position->line;
}

size_t position_column(const position_T* position) {
  return position->column;
}

position_T* position_copy(position_T* position) {
  if (position == NULL) { return NULL; }

  return position_init(position_line(position), position_column(position));
}

void position_free(position_T* position) {
  free(position);
}
