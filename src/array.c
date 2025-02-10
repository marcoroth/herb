#include "include/array.h"

size_t array_sizeof(void) { return sizeof(array_T); }

array_T *array_init(int capacity) {
  array_T *array = (array_T *)malloc(sizeof(array_T));

  array->size = 0;
  array->capacity = capacity;
  array->items = (void **)malloc(sizeof(void *) * capacity);

  return array;
}

void array_append(array_T *array, void *item) {
  if (array->size >= array->capacity) {
    array->capacity *= 2;
    array->items = (void **)realloc(array->items, sizeof(void *) * array->capacity);
  }

  array->items[array->size] = item;
  array->size++;
}

void *array_get(array_T *array, int index) {
  if (index >= array->size || index < 0) {
    return NULL;
  }

  return array->items[index];
}

void array_set(array_T *array, int index, void *item) {
  if (index >= array->size || index < 0) {
    return;
  }

  array->items[index] = item;
}

void array_remove(array_T *array, int index) {
  if (index >= array->size || index < 0) {
    return;
  }

  for (int i = index; i < array->size - 1; i++) {
    array->items[i] = array->items[i + 1];
  }

  array->size--;
}

size_t array_size(array_T *array) { return array->size; }

size_t array_capacity(array_T *array) { return array->capacity; }

void array_free(array_T *array) {
  free(array->items);
  free(array);
}
