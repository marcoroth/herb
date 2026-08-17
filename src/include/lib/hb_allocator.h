#ifndef HERB_ALLOCATOR_H
#define HERB_ALLOCATOR_H

#include <stdbool.h>
#include <stddef.h>

#include "../macros.h"
#include "hb_arena.h"

#ifndef HB_ALLOCATOR_DEFAULT_ARENA_SIZE
#  define HB_ALLOCATOR_DEFAULT_ARENA_SIZE KB(128)
#endif

typedef enum {
  HB_ALLOCATOR_MALLOC,
  HB_ALLOCATOR_ARENA,
  HB_ALLOCATOR_TRACKING,
} hb_allocator_type_T;

typedef struct {
  void* pointer;
  size_t size;
} hb_allocator_tracking_entry_T;

typedef struct {
  size_t allocation_count;
  size_t deallocation_count;
  size_t untracked_deallocation_count;
  size_t bytes_allocated;
  size_t bytes_deallocated;
  hb_allocator_tracking_entry_T* buckets;
  size_t buckets_capacity;
  size_t buckets_used;
  void** untracked_pointers;
  size_t untracked_pointers_size;
  size_t untracked_pointers_capacity;
} hb_allocator_tracking_stats_T;

typedef struct hb_allocator {
  void* (*alloc)(struct hb_allocator* self, size_t size);
  void* (*realloc)(struct hb_allocator* self, void* pointer, size_t old_size, size_t new_size);
  void (*dealloc)(struct hb_allocator* self, void* pointer);
  char* (*strdup)(struct hb_allocator* self, const char* string);
  char* (*strndup)(struct hb_allocator* self, const char* string, size_t length);
  void (*destroy)(struct hb_allocator* self);
  void* context;
} hb_allocator_T;

bool hb_allocator_init(hb_allocator_T* allocator, hb_allocator_type_T type);
bool hb_allocator_init_with_size(hb_allocator_T* allocator, hb_allocator_type_T type, size_t initial_size);
void hb_allocator_destroy(hb_allocator_T* allocator);

hb_allocator_T hb_allocator_with_malloc(void);
hb_allocator_T hb_allocator_with_arena(hb_arena_T* arena);
hb_allocator_T hb_allocator_with_tracking(void);

hb_allocator_tracking_stats_T* hb_allocator_tracking_stats(hb_allocator_T* allocator);

static inline void* hb_allocator_alloc(hb_allocator_T* allocator, size_t size) {
  return allocator->alloc(allocator, size);
}

static inline void* hb_allocator_realloc(hb_allocator_T* allocator, void* pointer, size_t old_size, size_t new_size) {
  return allocator->realloc(allocator, pointer, old_size, new_size);
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
