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

hb_allocator_T hb_allocator_with_malloc(void) {
  return (hb_allocator_T) {
    .alloc = malloc_alloc,
    .dealloc = malloc_dealloc,
    .strdup = malloc_strdup,
    .strndup = malloc_strndup,
    .context = NULL,
  };
}

// --- Arena backend ---

static void* arena_alloc(hb_allocator_T* self, size_t size) {
  return hb_arena_alloc((hb_arena_T*) self->context, size);
}

// Arena allocations are freed via hb_arena_free
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

hb_allocator_T hb_allocator_with_arena(hb_arena_T* arena) {
  return (hb_allocator_T) {
    .alloc = arena_alloc,
    .dealloc = arena_dealloc,
    .strdup = arena_strdup,
    .strndup = arena_strndup,
    .context = arena,
  };
}
