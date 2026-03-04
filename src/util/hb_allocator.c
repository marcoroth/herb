#include "../include/util/hb_allocator.h"
#include "../include/util/hb_arena.h"

#include <stdlib.h>
#include <string.h>

// --- Malloc backend ---

static void* malloc_alloc(hb_allocator_T* _self, size_t size) {
  return calloc(1, size);
}

static void malloc_dealloc(hb_allocator_T* _self, void* pointer) {
  free(pointer);
}

static char* malloc_strdup(hb_allocator_T* _self, const char* string) {
  if (!string) { return NULL; }

  size_t length = strlen(string);
  char* copy = malloc(length + 1);
  if (!copy) { return NULL; }

  memcpy(copy, string, length + 1);

  return copy;
}

static char* malloc_strndup(hb_allocator_T* _self, const char* string, size_t length) {
  if (!string) { return NULL; }

  char* copy = malloc(length + 1);
  if (!copy) { return NULL; }

  memcpy(copy, string, length);
  copy[length] = '\0';

  return copy;
}

static void malloc_destroy(hb_allocator_T* _self) {
}

hb_allocator_T hb_allocator_with_malloc(void) {
  return (hb_allocator_T) {
    .alloc = malloc_alloc,
    .dealloc = malloc_dealloc,
    .strdup = malloc_strdup,
    .strndup = malloc_strndup,
    .destroy = malloc_destroy,
    .context = NULL,
  };
}

// --- Arena backend ---

static void* arena_alloc(hb_allocator_T* self, size_t size) {
  return hb_arena_alloc((hb_arena_T*) self->context, size);
}

static void arena_dealloc(hb_allocator_T* _self, void* _pointer) {
}

static char* arena_strdup(hb_allocator_T* self, const char* string) {
  if (!string) { return NULL; }

  size_t length = strlen(string);
  char* copy = hb_arena_alloc((hb_arena_T*) self->context, length + 1);
  if (!copy) { return NULL; }

  memcpy(copy, string, length + 1);

  return copy;
}

static char* arena_strndup(hb_allocator_T* self, const char* string, size_t length) {
  if (!string) { return NULL; }

  char* copy = hb_arena_alloc((hb_arena_T*) self->context, length + 1);
  if (!copy) { return NULL; }

  memcpy(copy, string, length);
  copy[length] = '\0';

  return copy;
}

static void arena_destroy(hb_allocator_T* self) {
  hb_arena_T* arena = (hb_arena_T*) self->context;
  hb_arena_free(arena);
  free(arena);
  self->context = NULL;
}

hb_allocator_T hb_allocator_with_arena(hb_arena_T* arena) {
  return (hb_allocator_T) {
    .alloc = arena_alloc,
    .dealloc = arena_dealloc,
    .strdup = arena_strdup,
    .strndup = arena_strndup,
    .destroy = arena_destroy,
    .context = arena,
  };
}

// --- High-level API ---

bool hb_allocator_init(hb_allocator_T* allocator, hb_allocator_type_T type) {
  return hb_allocator_init_with_size(allocator, type, 0);
}

bool hb_allocator_init_with_size(hb_allocator_T* allocator, hb_allocator_type_T type, size_t initial_size) {
  switch (type) {
    case HB_ALLOCATOR_MALLOC: {
      *allocator = hb_allocator_with_malloc();
      return true;
    }

    case HB_ALLOCATOR_ARENA: {
      if (initial_size == 0) { initial_size = HB_ALLOCATOR_DEFAULT_ARENA_SIZE; }

      hb_arena_T* arena = malloc(sizeof(hb_arena_T));
      if (!arena) { return false; }

      if (!hb_arena_init(arena, initial_size)) {
        free(arena);
        return false;
      }

      *allocator = hb_allocator_with_arena(arena);
      return true;
    }

    default: return false;
  }
}

void hb_allocator_destroy(hb_allocator_T* allocator) {
  allocator->destroy(allocator);
}
