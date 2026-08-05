#ifndef HERB_PRISM_SERIALIZED_H
#define HERB_PRISM_SERIALIZED_H

#include <stddef.h>
#include <stdint.h>

typedef struct {
  uint8_t* data;
  size_t length;
} prism_serialized_T;

#endif
