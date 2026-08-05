#ifndef HERB_POSITION_H
#define HERB_POSITION_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

typedef struct POSITION_STRUCT {
  uint32_t line;
  uint32_t column;
} position_T;

position_T position_from_source_with_offset(const char* source, size_t offset);
bool position_is_within_range(position_T position, position_T start, position_T end);

#endif
