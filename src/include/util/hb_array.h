#ifndef HERB_ARRAY_H
#define HERB_ARRAY_H

#include <stdbool.h>
#include <stdlib.h>

typedef struct HB_ARRAY_STRUCT {
  void** items;
  size_t size;
  size_t capacity;
} hb_array_T;

hb_array_T* hb_array_init(size_t capacity);

void* hb_array_get(const hb_array_T* array, size_t index);
void* hb_array_first(hb_array_T* array);
void* hb_array_last(hb_array_T* array);

bool hb_array_append(hb_array_T* array, void* item);
void hb_array_set(const hb_array_T* array, size_t index, void* item);
void hb_array_free(hb_array_T** array);
void hb_array_remove(hb_array_T* array, size_t index);

size_t hb_array_index_of(hb_array_T* array, void* item);
void hb_array_remove_item(hb_array_T* array, void* item);

bool hb_array_push(hb_array_T* array, void* item);
void* hb_array_pop(hb_array_T* array);

size_t hb_array_capacity(const hb_array_T* array);
size_t hb_array_size(const hb_array_T* array);
size_t hb_array_sizeof(void);

#endif
