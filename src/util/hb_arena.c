#ifdef __linux__
#define _GNU_SOURCE
#endif

#include "../include/util/hb_arena.h"
#include "../include/macros.h"

#include <assert.h>
#include <stdbool.h>
#include <stdint.h>
#include <string.h>

#ifdef HB_USE_MALLOC
#include <stdlib.h>
#else
#include <sys/mman.h>
#endif

#define hb_arena_for_each_page(allocator, page)                                                                        \
  for (hb_arena_page_T* page = (allocator)->head; page != NULL; page = page->next)

static void* hb_system_allocate_memory(size_t size) {
#ifdef HB_USE_MALLOC
  return malloc(size);
#else
  void* memory = mmap(NULL, size, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
  if (memory == MAP_FAILED) { return NULL; }

  return memory;
#endif
}

static void hb_system_free_memory(void* ptr, size_t size) {
#ifdef HB_USE_MALLOC
  free(ptr);
#else
  munmap(ptr, size);
#endif
}

static inline size_t hb_arena_align_size(size_t size, size_t alignment) {
  assert(size <= SIZE_MAX - (alignment - 1));

  return ((size + (alignment - 1)) / alignment) * alignment;
}

static inline bool hb_arena_page_has_capacity(hb_arena_page_T* page, size_t required_size) {
  assert(page->position <= page->capacity);

  return page->position + required_size <= page->capacity;
}

static inline void* hb_arena_page_alloc(hb_arena_page_T* page, size_t size) {
  assert(size > 0);
  assert(page->position + size <= page->capacity);

  void* result = &page->memory[page->position];
  page->position += size;

  return result;
}

static size_t hb_arena_page_free(hb_arena_page_T* starting_page);

static bool hb_arena_append_page(hb_arena_T* allocator, size_t page_size) {
  assert(page_size <= SIZE_MAX - sizeof(hb_arena_page_T));
  size_t page_size_with_meta_data = page_size + sizeof(hb_arena_page_T);

  hb_arena_page_T* page = hb_system_allocate_memory(page_size_with_meta_data);
  if (page == NULL) { return false; }

  page->next = NULL;
  page->capacity = page_size;
  page->position = 0;

  if (allocator->head == NULL) {
    allocator->head = page;
    allocator->tail = page;
  } else {
    hb_arena_page_T* last = allocator->head;

    while (last->next != NULL) {
      last = last->next;
    }

    last->next = page;
    allocator->tail = page;
  }

  return true;
}

bool hb_arena_init(hb_arena_T* allocator, size_t default_page_size) {
  assert(default_page_size > 0);

  allocator->head = NULL;
  allocator->tail = NULL;
  allocator->default_page_size = default_page_size;
  allocator->allocation_count = 0;

  return hb_arena_append_page(allocator, default_page_size);
}

void* hb_arena_alloc(hb_arena_T* allocator, size_t size) {
  assert(allocator->tail != NULL);
  assert(size > 0);

  size_t required_size = hb_arena_align_size(size, 8);

  allocator->allocation_count++;

  if (hb_arena_page_has_capacity(allocator->tail, required_size)) {
    return hb_arena_page_alloc(allocator->tail, required_size);
  }

  for (hb_arena_page_T* page = allocator->tail->next; page != NULL; page = page->next) {
    if (hb_arena_page_has_capacity(page, required_size)) {
      allocator->tail = page;
      return hb_arena_page_alloc(allocator->tail, required_size);
    }
  }

  return hb_arena_page_alloc(allocator->tail, required_size);
}

size_t hb_arena_position(hb_arena_T* allocator) {
  size_t total = 0;

  hb_arena_for_each_page(allocator, page) {
    total += page->position;
  }

  return total;
}

size_t hb_arena_capacity(hb_arena_T* allocator) {
  size_t total = 0;

  hb_arena_for_each_page(allocator, page) {
    total += page->capacity;
  }

  return total;
}

void hb_arena_reset(hb_arena_T* allocator) {
  hb_arena_reset_to(allocator, 0);
}

void hb_arena_reset_to(hb_arena_T* allocator, size_t target_position) {
  hb_arena_page_T* current_page = allocator->head;
  size_t current_position = 0;

  while (current_page != NULL) {
    current_position += current_page->position;

    if (current_position >= target_position) {
      current_page->position -= current_position - target_position;
      break;
    }

    current_page = current_page->next;
  }

  if (current_page->next != NULL) {
    size_t freed_size = hb_arena_page_free(current_page->next);
    allocator->tail = current_page;
    current_page->next = NULL;

    hb_arena_append_page(allocator, freed_size);
  }
}

static size_t hb_arena_page_free(hb_arena_page_T* starting_page) {
  size_t freed_capacity = 0;

  for (hb_arena_page_T* current_page = starting_page; current_page != NULL;) {
    hb_arena_page_T* next_page = current_page->next;

    freed_capacity += current_page->capacity;

    size_t total_size = sizeof(hb_arena_page_T) + current_page->capacity;
    hb_system_free_memory(current_page, total_size);

    current_page = next_page;
  }

  return freed_capacity;
}

void hb_arena_free(hb_arena_T* allocator) {
  if (allocator->head == NULL) { return; }

  hb_arena_page_free(allocator->head);

  allocator->head = NULL;
  allocator->tail = NULL;
  allocator->default_page_size = 0;
}
