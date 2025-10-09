#ifndef HERB_MEMORY_ARENA_H
#define HERB_MEMORY_ARENA_H

#include <stddef.h>

typedef struct ARENA_ALLOCATOR_STRUCT {
  char* buffer;
  size_t position;
  size_t capacity;
} arena_allocator_T;

void* arena_alloc(arena_allocator_T* allocator, size_t size);
size_t arena_pos(arena_allocator_T* allocator);
void arena_clear(arena_allocator_T* allocator);

#endif
