#ifdef __linux__
#define _GNU_SOURCE
#endif

#include "../include/util/hb_arena.h"

#include <stdbool.h>
#include <sys/mman.h>

#define KB(kb) (1024 * kb)
#define MB(mb) (1024 * KB(mb))

bool hb_arena_init(hb_arena_T* allocator, size_t size) {
  allocator->memory = mmap(NULL, size, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);

  if (allocator->memory == MAP_FAILED) {
    allocator->memory = NULL;
    allocator->position = 0;
    allocator->capacity = 0;

    return false;
  }

  allocator->position = 0;
  allocator->capacity = size;

  return true;
}

void* hb_arena_alloc(hb_arena_T* allocator, size_t size) {
  size_t required_size = ((size + 7) / 8) * 8; // rounds up to the next 8 bytes

  if (allocator->position + required_size > allocator->capacity) { return NULL; }

  size_t offset = allocator->position;
  void* ptr = &allocator->memory[offset];
  allocator->position += required_size;

  return ptr;
}

size_t hb_arena_position(hb_arena_T* allocator) {
  return allocator->position;
}

void hb_arena_reset(hb_arena_T* allocator) {
  allocator->position = 0;
}

void hb_arena_reset_to(hb_arena_T* allocator, size_t new_position) {
  if (new_position <= allocator->capacity) { allocator->position = new_position; }
}

void hb_arena_free(hb_arena_T* allocator) {
  if (allocator->memory != NULL) {
    munmap(allocator->memory, allocator->capacity);

    allocator->memory = NULL;
    allocator->position = 0;
    allocator->capacity = 0;
  }
}
