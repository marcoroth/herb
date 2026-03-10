#ifndef HERB_NARRAY_H
#define HERB_NARRAY_H

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>

#include "hb_allocator.h"

typedef struct HB_NARRAY_STRUCT {
  hb_allocator_T* allocator;
  uint8_t* items;
  size_t item_size;
  size_t size;
  size_t capacity;
} hb_narray_T;

bool hb_narray_init(hb_narray_T* array, size_t item_size, size_t initial_capacity, hb_allocator_T* allocator);
#define hb_narray_pointer_init(array, initial_capacity, allocator)                                                     \
  (hb_narray_init(array, sizeof(void*), initial_capacity, allocator))

void* hb_narray_get(const hb_narray_T* array, size_t index);
void* hb_narray_first(hb_narray_T* array);
void* hb_narray_last(hb_narray_T* array);
size_t hb_narray_size(const hb_narray_T* array);

bool hb_narray_append(hb_narray_T* array, void* item);
void hb_narray_remove(hb_narray_T* array, size_t index);
void hb_narray_deinit(hb_narray_T* array);

#define hb_narray_push(array, item) (hb_narray_append(array, item))
bool hb_narray_pop(hb_narray_T* array, void* item);

#endif
