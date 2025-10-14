#include "include/range.h"

uint32_t range_length(range_T range) {
  return range.to - range.from;
}
