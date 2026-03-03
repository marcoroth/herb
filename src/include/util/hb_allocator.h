#ifndef HERB_ALLOCATOR_H
#define HERB_ALLOCATOR_H

#include <stddef.h>

#include "hb_arena.h"

typedef struct hb_allocator {
  void* (*alloc)(struct hb_allocator* self, size_t size);
  void (*dealloc)(struct hb_allocator* self, void* pointer);
  char* (*strdup)(struct hb_allocator* self, const char* string);
  char* (*strndup)(struct hb_allocator* self, const char* string, size_t length);
  void* context;
} hb_allocator_T;

hb_allocator_T hb_allocator_with_malloc(void);
hb_allocator_T hb_allocator_with_arena(hb_arena_T* arena);

static inline void* hb_allocator_alloc(hb_allocator_T* allocator, size_t size) {
  return allocator->alloc(allocator, size);
}

static inline void hb_allocator_dealloc(hb_allocator_T* allocator, void* pointer) {
  allocator->dealloc(allocator, pointer);
}

static inline char* hb_allocator_strdup(hb_allocator_T* allocator, const char* string) {
  return allocator->strdup(allocator, string);
}

static inline char* hb_allocator_strndup(hb_allocator_T* allocator, const char* string, size_t length) {
  return allocator->strndup(allocator, string, length);
}

#endif
