#ifndef ERBX_LIST_H
#define ERBX_LIST_H

#include <stdlib.h>

typedef struct LIST_STRUCT {
  void** items;
  size_t size;
  size_t item_size;
} list_T;

list_T* init_list(size_t item_size);
void list_push(list_T* list, void* item);

#endif
