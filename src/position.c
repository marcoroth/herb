#include "include/position.h"
#include "include/memory.h"

size_t position_sizeof(void) {
  return sizeof(position_T);
}

position_T* position_init(const uint32_t line, const uint32_t column) {
  position_T* position = safe_malloc(position_sizeof());

  position->line = line;
  position->column = column;

  return position;
}

position_T* position_copy(position_T* position) {
  if (position == NULL) { return NULL; }

  return position_init(position->line, position->column);
}
