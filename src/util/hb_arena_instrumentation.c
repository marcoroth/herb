#include "../include/util/hb_arena_instrumentation.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/mman.h>
#include <fcntl.h>
#include <unistd.h>

#define HB_ARENA_INSTRUMENTATION_FILE "arena_instrumentation.bin"
#define HB_ARENA_INSTRUMENTATION_MAP_SIZE (1024UL * 1024UL * 1024UL * 24UL)

typedef struct HB_ARENA_INSTRUMENTATION_STRUCT {
  size_t current_position;
  size_t map_size;
  char* memory;
  int file;
} hb_arena_instrumentation_T;

hb_arena_instrumentation_T hb_arena_instrumentation = { 0 };

void hb_arena_instrumentation_log_init(const hb_arena_T* arena) {
  if (hb_arena_instrumentation.memory == NULL) {
    hb_arena_instrumentation.map_size = HB_ARENA_INSTRUMENTATION_MAP_SIZE;
    hb_arena_instrumentation.file = open(HB_ARENA_INSTRUMENTATION_FILE,  O_RDWR | O_CREAT | O_TRUNC, 0644);
    ftruncate(hb_arena_instrumentation.file, (off_t)hb_arena_instrumentation.map_size);

    hb_arena_instrumentation.memory = mmap(
      NULL,
      hb_arena_instrumentation.map_size,
      PROT_READ | PROT_WRITE,
      MAP_SHARED,
      hb_arena_instrumentation.file,
      0
    );

    if (hb_arena_instrumentation.file < 0) {
      perror("open failed");
      exit(1);
    }

    if (hb_arena_instrumentation.memory == MAP_FAILED) {
      exit(1);
    }
  }

  size_t *count = (size_t*)hb_arena_instrumentation.memory;
  *count = 1;

  hb_arena_instrumentation.current_position = sizeof(size_t);
  hb_arena_instrumentation_event_T* event = (hb_arena_instrumentation_event_T*)((char*)hb_arena_instrumentation.memory + hb_arena_instrumentation.current_position);

  event->type = HB_ARENA_INSTRUMENTATION_EVENT_INIT;
  event->time = hb_arena_instrumentation.current_position;
  event->data.init_data.default_size = arena->default_page_size;

  hb_arena_instrumentation.current_position += sizeof(hb_arena_instrumentation_event_T);
}

void hb_arena_instrumentation_log_alloc(const hb_arena_T* arena, size_t allocation_size) {
  if (hb_arena_instrumentation.memory == NULL) { return; }

  size_t page_count = 0;
  for (hb_arena_page_T* page = arena->head; page != NULL; page = page->next) {
    page_count++;
  }

  size_t event_size = sizeof(hb_arena_instrumentation_event_T) + page_count * sizeof(hb_arena_instrumentation_page_state_T);
  size_t needed_size = hb_arena_instrumentation.current_position + event_size;

  if (needed_size >= hb_arena_instrumentation.map_size) {
    return;
  }

  size_t *count = (size_t*)hb_arena_instrumentation.memory;
  *count += 1;

  hb_arena_instrumentation_event_T* event = (hb_arena_instrumentation_event_T*)((char*)hb_arena_instrumentation.memory + hb_arena_instrumentation.current_position);

  event->type = HB_ARENA_INSTRUMENTATION_EVENT_ALLOC;
  event->time = hb_arena_instrumentation.current_position;
  event->data.alloc_data.allocation_size = allocation_size;
  event->data.alloc_data.page_count = 0;

  hb_arena_page_T *current_page = arena->head;

  while(current_page != NULL) {
    event->page_states[event->data.alloc_data.page_count].address = (uintptr_t)current_page->memory;
    event->page_states[event->data.alloc_data.page_count].capacity = current_page->capacity;
    event->page_states[event->data.alloc_data.page_count].position = current_page->position;

    event->data.alloc_data.page_count += 1;
    current_page = current_page->next;
  }

  hb_arena_instrumentation.current_position += sizeof(hb_arena_instrumentation_event_T) + event->data.alloc_data.page_count * sizeof(hb_arena_instrumentation_page_state_T);
}

void hb_arena_instrumentation_log_reset(const hb_arena_T* arena, size_t reset_position) {
  if (hb_arena_instrumentation.memory == NULL) { return; }

  size_t page_count = 0;
  for (hb_arena_page_T* page = arena->head; page != NULL; page = page->next) {
    page_count++;
  }

  size_t event_size = sizeof(hb_arena_instrumentation_event_T) + page_count * sizeof(hb_arena_instrumentation_page_state_T);
  size_t needed_size = hb_arena_instrumentation.current_position + event_size;

  if (needed_size >= hb_arena_instrumentation.map_size) {
    return;
  }

  size_t *count = (size_t*)hb_arena_instrumentation.memory;
  *count += 1;

  hb_arena_instrumentation_event_T* event = (hb_arena_instrumentation_event_T*)((char*)hb_arena_instrumentation.memory + hb_arena_instrumentation.current_position);

  event->type = HB_ARENA_INSTRUMENTATION_EVENT_RESET;
  event->time = hb_arena_instrumentation.current_position;
  event->data.reset_data.reset_position = reset_position;
  event->data.reset_data.page_count = 0;

  hb_arena_page_T *current_page = arena->head;

  while(current_page != NULL) {
    event->page_states[event->data.reset_data.page_count].address = (uintptr_t)current_page->memory;
    event->page_states[event->data.reset_data.page_count].capacity = current_page->capacity;
    event->page_states[event->data.reset_data.page_count].position = current_page->position;

    event->data.reset_data.page_count += 1;
    current_page = current_page->next;
  }

  hb_arena_instrumentation.current_position += sizeof(hb_arena_instrumentation_event_T) + event->data.reset_data.page_count * sizeof(hb_arena_instrumentation_page_state_T);
}

void hb_arena_instrumentation_done(void) {
  if (hb_arena_instrumentation.memory == NULL) { return; }

  msync(hb_arena_instrumentation.memory, hb_arena_instrumentation.map_size, MS_SYNC);
  munmap(hb_arena_instrumentation.memory, hb_arena_instrumentation.map_size);
  ftruncate(hb_arena_instrumentation.file, (off_t)hb_arena_instrumentation.current_position);
  close(hb_arena_instrumentation.file);

  hb_arena_instrumentation.memory = NULL;
  hb_arena_instrumentation.file = 0;
  hb_arena_instrumentation.map_size = 0;
  hb_arena_instrumentation.current_position = 0;
}
