#ifndef HERB_ARRAY_H
#define HERB_ARRAY_H

#include <stdlib.h>

typedef struct ARRAY_STRUCT {
  void** items;
  size_t size;
  size_t capacity;
} array_T;

array_T* array_init(size_t capacity);

void* array_get(const array_T* array, size_t index);
void* array_last(array_T* array);

void array_append(array_T* array, void* item);
#define array_push(array, item) (array_append(array, item))
void array_free(array_T** array);

void* array_pop(array_T* array);

size_t array_capacity(const array_T* array);
size_t array_size(const array_T* array);
size_t array_sizeof(void);

#endif
