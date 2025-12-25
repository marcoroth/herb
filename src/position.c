#include "include/position.h"
#include "include/util.h"

position_T position_from_source_with_offset(const char* source, size_t offset) {
  position_T position = { .line = 1, .column = 0 };

  for (size_t i = 0; i < offset; i++) {
    if (is_newline(source[i])) {
      position.line++;
      position.column = 0;
    } else {
      position.column++;
    }
  }

  return position;
}

bool position_is_within_range(position_T position, position_T start, position_T end) {
  if (position.line < start.line) { return false; }
  if (position.line == start.line && position.column < start.column) { return false; }

  if (position.line > end.line) { return false; }
  if (position.line == end.line && position.column > end.column) { return false; }

  return true;
}
