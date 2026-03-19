#include <stdint.h>
#include <stdio.h>

#include "../include/macros.h"
#include "../include/util/hb_allocator.h"
#include "../include/util/hb_array.h"

size_t hb_array_sizeof(void) {
  return sizeof(hb_array_T);
}

hb_array_T* hb_array_init(const size_t capacity, hb_allocator_T* allocator) {
  hb_array_T* array = hb_allocator_alloc(allocator, hb_array_sizeof());

  if (!array) { return NULL; }

  array->size = 0;
  array->capacity = capacity;
  array->allocator = allocator;

  if (capacity == 0) {
    array->items = NULL;
  } else {
    array->items = hb_allocator_alloc(allocator, capacity * sizeof(void*));

    if (!array->items) {
      hb_allocator_dealloc(allocator, array);
      return NULL;
    }
  }

  return array;
}

bool hb_array_append(hb_array_T* array, void* item) {
  if (!array) { return false; }

  if (array->size >= array->capacity) {
    size_t new_capacity;

    if (array->capacity == 0) {
      new_capacity = 1;
    } else if (array->capacity > SIZE_MAX / (2 * sizeof(void*))) {
      fprintf(stderr, "Warning: Approaching array size limits, using conservative growth.\n");
      new_capacity = array->capacity + 1024 / sizeof(void*);

      if (new_capacity < array->capacity) { new_capacity = SIZE_MAX / sizeof(void*); }
    } else {
      new_capacity = array->capacity * 2;
    }

    if (new_capacity > SIZE_MAX / sizeof(void*)) {
      fprintf(stderr, "Error: Array allocation would exceed system limits.\n");
      return false;
    }

    size_t old_size_bytes = array->capacity * sizeof(void*);
    size_t new_size_bytes = new_capacity * sizeof(void*);
    void** new_items = hb_allocator_realloc(array->allocator, array->items, old_size_bytes, new_size_bytes);

    if (unlikely(new_items == NULL)) { return false; }

    array->items = new_items;
    array->capacity = new_capacity;
  }

  array->items[array->size] = item;
  array->size++;

  return true;
}

void* hb_array_get(const hb_array_T* array, const size_t index) {
  if (index >= array->size) { return NULL; }

  return array->items[index];
}

void* hb_array_first(hb_array_T* array) {
  if (!array || array->size == 0) { return NULL; }
  return array->items[0];
}

void* hb_array_last(hb_array_T* array) {
  if (!array || array->size == 0) { return NULL; }
  return array->items[array->size - 1];
}

void hb_array_set(const hb_array_T* array, const size_t index, void* item) {
  if (index >= array->size) { return; }

  array->items[index] = item;
}

void hb_array_remove(hb_array_T* array, const size_t index) {
  if (index >= array->size) { return; }

  for (size_t i = index; i < array->size - 1; i++) {
    array->items[i] = array->items[i + 1];
  }

  array->size--;
}

size_t hb_array_index_of(hb_array_T* array, void* item) {
  for (size_t i = 0; i < array->size; i++) {
    if (array->items[i] == item) { return i; }
  }

  return SIZE_MAX;
}

void hb_array_remove_item(hb_array_T* array, void* item) {
  size_t index = hb_array_index_of(array, item);

  if (index != SIZE_MAX) { hb_array_remove(array, index); }
}

bool hb_array_append_lazy(hb_array_T** array, void* item, hb_allocator_T* allocator) {
  if (*array == NULL) {
    *array = hb_array_init(8, allocator);
    if (!*array) { return false; }
  }

  return hb_array_append(*array, item);
}

// Alias for hb_array_append
bool hb_array_push(hb_array_T* array, void* item) {
  return hb_array_append(array, item);
}

void* hb_array_pop(hb_array_T* array) {
  if (!array || array->size == 0) { return NULL; }

  void* last_item = hb_array_last(array);
  array->size--;

  return last_item;
}

// TODO: Remove this function once we fully migrate to hb_narray
size_t hb_array_size(const hb_array_T* array) {
  if (array == NULL) { return 0; }

  return array->size;
}

size_t hb_array_capacity(const hb_array_T* array) {
  return array->capacity;
}

void hb_array_free(hb_array_T** array) {
  if (!array || !*array) { return; }

  hb_allocator_T* allocator = (*array)->allocator;
  hb_allocator_dealloc(allocator, (*array)->items);
  hb_allocator_dealloc(allocator, *array);

  *array = NULL;
}
