#ifndef ERBX_ARRAY_H
#define ERBX_ARRAY_H

#include <stdlib.h>

typedef struct ARRAY_STRUCT {
  void** items;
  size_t size;
  size_t capacity;
} array_T;

array_T* array_init(int capacity);

void* array_get(array_T* array, int index);

void array_append(array_T* array, void* item);
void array_set(array_T* array, int index, void* item);
void array_free(array_T* array);
void array_remove(array_T* array, int index);

size_t array_capacity(array_T* array);
size_t array_size(array_T* array);
size_t array_sizeof(void);

#endif
