#include "memory.h"

#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>

static void* safe_malloc_internal(size_t size, bool fail_fast) {
  if (size == 0) size = 1;

  void* pointer = malloc(size);

  if (!pointer) {
    fprintf(stderr, "Error: Failed to allocate %zu bytes.\n", size);
    if (fail_fast) exit(1);
    return nullptr;
  }

  return pointer;
}

static void* safe_realloc_internal(void* pointer, size_t new_size, bool fail_fast) {
  if (new_size == 0) new_size = 1;

  if (!pointer) return safe_malloc_internal(new_size, fail_fast);

  void* new_pointer = realloc(pointer, new_size);

  if (!new_pointer) {
    fprintf(stderr, "Error: Memory reallocation failed (size: %zu bytes).\n", new_size);
    if (fail_fast) exit(1);
    return nullptr;
  }

  return new_pointer;
}

void* safe_malloc(size_t size) {
  return safe_malloc_internal(size, true);
}

void* nullable_safe_malloc(size_t size) {
  return safe_malloc_internal(size, false);
}

void* safe_realloc(void* pointer, size_t new_size) {
  return safe_realloc_internal(pointer, new_size, true);
}

void* nullable_safe_realloc(void* pointer, size_t new_size) {
  return safe_realloc_internal(pointer, new_size, false);
}
