#ifndef HERB_ARENA_H
#define HERB_ARENA_H

#include <stdbool.h>
#include <stddef.h>

typedef struct HB_ARENA_ALLOCATOR_STRUCT {
  char* memory;
  size_t capacity;
  size_t position;
} hb_arena_T;

bool hb_arena_init(hb_arena_T* allocator, size_t size);
void* hb_arena_alloc(hb_arena_T* allocator, size_t size);
size_t hb_arena_position(hb_arena_T* allocator);
void hb_arena_reset(hb_arena_T* allocator);
void hb_arena_reset_to(hb_arena_T* allocator, size_t new_position);
void hb_arena_free(hb_arena_T* allocator);

#endif
