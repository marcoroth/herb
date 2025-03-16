#include <stdint.h>
#include <stdio.h>

#include "include/array.h"
#include "include/macros.h"
#include "include/memory.h"

size_t array_sizeof(void) {
  return sizeof(array_T);
}

array_T* array_init(const size_t capacity) {
  array_T* array = safe_malloc(array_sizeof());

  array->size = 0;
  array->capacity = capacity;
  array->items = nullable_safe_malloc(sizeof(void*) * capacity);

  if (!array->items) {
    free(array);
    return NULL;
  }

  return array;
}

void array_append(array_T* array, void* item) {
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
      return;
    }

    size_t new_size_bytes = new_capacity * sizeof(void*);
    void* new_items = safe_realloc(array->items, new_size_bytes);

    if (unlikely(new_items == NULL)) { return; }

    array->items = (void**) new_items;
    array->capacity = new_capacity;
  }

  array->items[array->size] = item;
  array->size++;
}

void* array_get(const array_T* array, const size_t index) {
  if (index >= array->size) { return NULL; }

  return array->items[index];
}

void* array_first(array_T* array) {
  if (!array || array->size == 0) { return NULL; }
  return array->items[0];
}

void* array_last(array_T* array) {
  if (!array || array->size == 0) { return NULL; }
  return array->items[array->size - 1];
}

void array_set(const array_T* array, const size_t index, void* item) {
  if (index >= array->size) { return; }

  array->items[index] = item;
}

void array_remove(array_T* array, const size_t index) {
  if (index >= array->size) { return; }

  for (size_t i = index; i < array->size - 1; i++) {
    array->items[i] = array->items[i + 1];
  }

  array->size--;
}

size_t array_index_of(array_T* array, void* item) {
  for (size_t i = 0; i < array->size; i++) {
    if (array->items[i] == item) { return i; }
  }

  return SIZE_MAX;
}

void array_remove_item(array_T* array, void* item) {
  size_t index = array_index_of(array, item);

  if (index != SIZE_MAX) { array_remove(array, index); }
}

// Alias for array_append
void array_push(array_T* array, void* item) {
  array_append(array, item);
}

void* array_pop(array_T* array) {
  if (!array || array->size == 0) { return NULL; }

  void* last_item = array_last(array);
  array->size--;

  return last_item;
}

size_t array_size(const array_T* array) {
  if (array == NULL) { return 0; }

  return array->size;
}

size_t array_capacity(const array_T* array) {
  return array->capacity;
}

void array_free(array_T** array) {
  if (!array || !*array) { return; }

  free((*array)->items);
  free(*array);

  *array = NULL;
}
