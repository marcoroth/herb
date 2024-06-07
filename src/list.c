#include "include/list.h"

list_T* list_init(size_t item_size) {
  list_T* list = calloc(1, sizeof(struct LIST_STRUCT));
  list->size = 0;
  list->item_size = item_size;
  list->items = 0;

  return list;
}

void list_push(list_T* list, void* item) {
  list->size += 1;

  if (!list->items) {
    list->items = calloc(1, list->item_size);
  } else {
    list->items = realloc(list->items, (list->size * list->item_size));
  }

  list->items[list->size] = item;
}
