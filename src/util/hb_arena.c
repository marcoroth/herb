#include "../include/util/hb_arena.h"
#include "../include/util/hb_arena_instrumentation.h"
#include "../include/macros.h"
#include "../include/util/hb_system.h"

#include <assert.h>
#include <stdbool.h>
#include <stdint.h>
#include <string.h>

#define hb_arena_for_each_page(allocator, _page)                                                                       \
  for (hb_arena_page_T* page = (allocator)->head; page != NULL; page = page->next)

static inline size_t hb_arena_align_size(size_t size, size_t alignment) {
  assert(size <= SIZE_MAX - (alignment - 1));

  return ((size + (alignment - 1)) / alignment) * alignment;
}

static inline bool hb_arena_page_has_capacity(hb_arena_page_T* page, size_t required_size) {
  assert(page->position <= page->capacity);

  return page->position + required_size <= page->capacity;
}

static inline void* hb_arena_page_alloc_from(hb_arena_page_T* page, size_t size) {
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

  hb_arena_page_T* page = hb_system_allocate_memory(total_size);
  if (page == NULL) { return false; }

  *page = (hb_arena_page_T) { .next = NULL, .capacity = page_size, .position = 0 };

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

bool hb_arena_init(hb_arena_T* allocator, size_t initial_size) {
  assert(initial_size > 0);

  allocator->head = NULL;
  allocator->tail = NULL;
  allocator->default_page_size = initial_size;
  allocator->allocation_count = 0;

  hb_arena_instrumentation_log_init(allocator);

  return hb_arena_append_page(allocator, initial_size);
}

void* hb_arena_alloc(hb_arena_T* allocator, size_t size) {
  assert(allocator->tail != NULL);
  assert(size > 0);

  size_t required_size = hb_arena_align_size(size, 8);

  allocator->allocation_count++;

  if (hb_arena_page_has_capacity(allocator->tail, required_size)) {
    void *allocation = hb_arena_page_alloc_from(allocator->tail, required_size);
    hb_arena_instrumentation_log_alloc(allocator, size);
    return allocation;
  }

  for (hb_arena_page_T* page = allocator->tail->next; page != NULL; page = page->next) {
    if (hb_arena_page_has_capacity(page, required_size)) {
      allocator->tail = page;

      void* allocation =  hb_arena_page_alloc_from(allocator->tail, required_size);
      hb_arena_instrumentation_log_alloc(allocator, size);
      return allocation;
    }
  }

  bool allocated = hb_arena_append_page(allocator, required_size);

  if (!allocated) { return NULL; }

  void* allocation = hb_arena_page_alloc_from(allocator->tail, required_size);

  hb_arena_instrumentation_log_alloc(allocator, size);

  return allocation;
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
  hb_arena_for_each_page(allocator, page) {
    hb_arena_page_reset(page);
  }

  allocator->tail = allocator->head;
  allocator->allocation_count = 0;

  hb_arena_instrumentation_log_reset(allocator, 0);
}

void hb_arena_reset_to(hb_arena_T* allocator, size_t target_position) {
  if (target_position == 0) {
    hb_arena_reset(allocator);
    return;
  }

  size_t accumulated = 0;

  hb_arena_for_each_page(allocator, page) {
    if (accumulated + page->capacity >= target_position) {
      page->position = target_position - accumulated;
      allocator->tail = page;

      hb_arena_reset_pages_after(page->next);

      return;
    }

    accumulated += page->capacity;
    page->position = page->capacity;
  }

  hb_arena_instrumentation_log_reset(allocator, target_position);
}

void hb_arena_free(hb_arena_T* allocator) {
  if (allocator->head == NULL) { return; }

  for (hb_arena_page_T* current = allocator->head; current != NULL;) {
    hb_arena_page_T* next = current->next;
    size_t total_size = sizeof(hb_arena_page_T) + current->capacity;
    hb_system_free_memory(current, total_size);

    current = next;
  }

  allocator->head = NULL;
  allocator->tail = NULL;
  allocator->default_page_size = 0;
}
