#include "memory.h"

#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

static void* safe_malloc_internal(const size_t size, const bool fail_fast) {
  if (size == 0) { return NULL; }

  void* pointer = malloc(size);

  if (!pointer) {
    fprintf(stderr, "Error: Failed to allocate %zu bytes.\n", size);
    fflush(stderr);
    if (fail_fast) { exit(1); }
    return NULL;
  }

  return pointer;
}

static void* safe_realloc_internal(void* pointer, const size_t new_size, const bool fail_fast) {
  if (new_size == 0) { return NULL; }

  if (!pointer) { return safe_malloc_internal(new_size, fail_fast); }

  void* new_pointer = realloc(pointer, new_size);

  if (!new_pointer) {
    fprintf(stderr, "Error: Memory reallocation failed (size: %zu bytes).\n", new_size);
    fflush(stderr);
    if (fail_fast) { exit(1); }
    return NULL;
  }

  return new_pointer;
}

void* safe_malloc(const size_t size) {
  return safe_malloc_internal(size, true);
}

void* nullable_safe_malloc(const size_t size) {
  return safe_malloc_internal(size, false);
}

void* safe_realloc(void* pointer, const size_t new_size) {
  return safe_realloc_internal(pointer, new_size, true);
}

void* nullable_safe_realloc(void* pointer, const size_t new_size) {
  return safe_realloc_internal(pointer, new_size, false);
}
