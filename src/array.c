#include <stdio.h>

#include "include/array.h"
#include "include/macros.h"
#include "include/memory.h"

size_t array_sizeof(void) {
  return sizeof(array_T);
}

array_T* array_init(size_t capacity) {
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
    size_t new_capacity = (array->capacity > 0) ? array->capacity * 2 : 1;
    void* new_items = safe_realloc(array->items, sizeof(void*) * new_capacity);

    if (unlikely(new_items == NULL)) { return; }

    array->items = (void**) new_items;
    array->capacity = new_capacity;
  }

  array->items[array->size] = item;
  array->size++;
}

void* array_get(array_T* array, size_t index) {
  if (index >= array->size || index < 0) { return NULL; }

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

void array_set(array_T* array, size_t index, void* item) {
  if (index >= array->size) { return; }

  array->items[index] = item;
}

void array_remove(array_T* array, size_t index) {
  if (index >= array->size) { return; }

  for (size_t i = index; i < array->size - 1; i++) {
    array->items[i] = array->items[i + 1];
  }

  array->size--;
}

size_t array_size(array_T* array) {
  return array->size;
}

size_t array_capacity(array_T* array) {
  return array->capacity;
}

void array_free(array_T** array) {
  if (!array || !(*array)) { return; }

  free((*array)->items);
  free(*array);

  *array = NULL;
}
