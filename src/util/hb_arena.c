#ifdef __linux__
#define _GNU_SOURCE
#endif

#include "../include/util/hb_arena.h"
#include "../include/macros.h"

#include <assert.h>
#include <stdbool.h>
#include <stdint.h>
#include <string.h>
#include <sys/mman.h>

#define hb_arena_for_each_page(allocator, page)                                                                        \
  for (hb_arena_page_T* page = (allocator)->head; page != NULL; page = page->next)

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

static inline void hb_arena_page_reset(hb_arena_page_T* page) {
  page->position = 0;
}

static inline void hb_arena_reset_pages_after(hb_arena_page_T* start_page) {
  for (hb_arena_page_T* page = start_page; page != NULL; page = page->next) {
    hb_arena_page_reset(page);
  }
}

static bool hb_arena_append_page(hb_arena_T* allocator, size_t minimum_size) {
  assert(minimum_size > 0);

  size_t page_size = MAX(allocator->default_page_size, minimum_size);

  assert(page_size <= SIZE_MAX - sizeof(hb_arena_page_T));
  size_t total_size = page_size + sizeof(hb_arena_page_T);

  hb_arena_page_T* page = mmap(NULL, total_size, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);

  if (page == MAP_FAILED) { return false; }

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
  // TODO
}

static size_t hb_arena_page_free(hb_arena_page_T* starting_page) {
  size_t freed_capacity = 0;

  for (hb_arena_page_T* current_page = starting_page; current_page != NULL;) {
    hb_arena_page_T* next_page = current_page->next;

    freed_capacity += current_page->capacity;

    size_t total_size = sizeof(hb_arena_page_T) + current_page->capacity;
    munmap(current_page, total_size);

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
