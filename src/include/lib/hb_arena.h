#ifndef HERB_ARENA_H
#define HERB_ARENA_H

#include <stdbool.h>
#include <stddef.h>

typedef struct HB_ARENA_PAGE_STRUCT hb_arena_page_T;

struct HB_ARENA_PAGE_STRUCT {
  hb_arena_page_T* next;
  size_t capacity;
  size_t position;
  char memory[];
};

#define HB_ARENA_FREE_LIST_MAX_SIZE 64
#define HB_ARENA_FREE_LIST_COUNT (HB_ARENA_FREE_LIST_MAX_SIZE / 8)

typedef struct HB_ARENA_FREE_BLOCK_STRUCT {
  struct HB_ARENA_FREE_BLOCK_STRUCT* next;
} hb_arena_free_block_T;

typedef struct HB_ARENA_STRUCT {
  hb_arena_page_T* head;
  hb_arena_page_T* tail;
  size_t default_page_size;
  size_t allocation_count;
  hb_arena_free_block_T* free_lists[HB_ARENA_FREE_LIST_COUNT];
} hb_arena_T;

#define hb_arena_for_each_page(arena) for (hb_arena_page_T* page = (arena)->head; page != NULL; page = page->next)

#define hb_arena_for_each_page_const(arena)                                                                            \
  for (const hb_arena_page_T* page = (arena)->head; page != NULL; page = page->next)

bool hb_arena_init(hb_arena_T* allocator, size_t initial_size);
void* hb_arena_alloc(hb_arena_T* allocator, size_t size);
void hb_arena_release(hb_arena_T* allocator, void* pointer, size_t size);
size_t hb_arena_position(hb_arena_T* allocator);
size_t hb_arena_capacity(hb_arena_T* allocator);
void hb_arena_reset(hb_arena_T* allocator);
void hb_arena_reset_to(hb_arena_T* allocator, size_t target_position);
void hb_arena_free(hb_arena_T* allocator);

#endif
