#include "../include/util/hb_narray.h"

#include <assert.h>
#include <stdbool.h>
#include <string.h>

bool hb_narray_init(hb_narray_T* array, size_t item_size, size_t initial_capacity) {
  assert(initial_capacity != 0);

  array->item_size = item_size;
  array->capacity = initial_capacity;
  array->size = 0;
  array->items = malloc(array->capacity * array->item_size);

  if (!array->items) { return false; }

  return true;
}

bool hb_narray_append(hb_narray_T* array, void* item) {
  if (array->size + 1 > array->capacity) {
    size_t new_capacity = array->capacity * 2;
    void* new_buffer = realloc(array->items, new_capacity * array->item_size);

    if (!new_buffer) { return false; }

    array->items = new_buffer;
    array->capacity = new_capacity;
  }

  memcpy(array->items + (array->size * array->item_size), item, array->item_size);
  array->size += 1;

  return true;
}

static inline uint8_t* hb_narray_memory_position(const hb_narray_T* array, size_t index) {
  return array->items + (array->item_size * index);
}

void hb_narray_remove(hb_narray_T* array, size_t index) {
  assert(index < array->size);

  if (array->size - 1 > index) {
    size_t elements_to_shift = (array->size - 1) - index;
    size_t bytes_to_shift = array->item_size * elements_to_shift;

    memcpy(hb_narray_memory_position(array, index), hb_narray_memory_position(array, index + 1), bytes_to_shift);
  }

  array->size -= 1;
}

void* hb_narray_get(const hb_narray_T* array, size_t index) {
  assert(index < array->size);

  return hb_narray_memory_position(array, index);
}

void* hb_narray_first(hb_narray_T* array) {
  if (array->size == 0) { return NULL; }

  return hb_narray_get(array, 0);
}

void* hb_narray_last(hb_narray_T* array) {
  if (array->size == 0) { return NULL; }
  return hb_narray_get(array, array->size - 1);
}

bool hb_narray_pop(hb_narray_T* array, void* item) {
  if (array->size == 0) { return false; }
  memcpy(item, hb_narray_last(array), array->item_size);
  array->size -= 1;

  return true;
}

void hb_narray_deinit(hb_narray_T* array) {
  array->item_size = 0;
  array->capacity = 0;
  array->size = 0;
  free(array->items);
}

size_t hb_narray_size(const hb_narray_T* array) {
  if (array == NULL) { return 0; }

  return array->size;
}
