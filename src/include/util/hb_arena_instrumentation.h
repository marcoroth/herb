#ifndef HERB_ARENA_INSTRUMENTATION_H
#define HERB_ARENA_INSTRUMENTATION_H

#include "hb_arena.h"
#include <stdint.h>

typedef enum {
  HB_ARENA_INSTRUMENTATION_EVENT_INIT,
  HB_ARENA_INSTRUMENTATION_EVENT_ALLOC,
  HB_ARENA_INSTRUMENTATION_EVENT_RESET,
} hb_arena_instrumentation_event_type_T;

typedef struct HB_ARENA_INSTRUMENTATION_PAGE_STATE_STRUCT {
  uintptr_t address;
  size_t capacity;
  size_t position;
} hb_arena_instrumentation_page_state_T;

typedef struct HB_ARENA_INSTRUMENTATION_EVENT_STRUCT {
  hb_arena_instrumentation_event_type_T type;
  size_t time;
  union {
    struct {
      size_t default_size;
    } init_data;
    struct {
      size_t allocation_size;
      size_t page_count;
    } alloc_data;
    struct {
      size_t reset_position;
      size_t page_count;
    } reset_data;
  } data;
  hb_arena_instrumentation_page_state_T page_states[];
} hb_arena_instrumentation_event_T;

void hb_arena_instrumentation_log_init(const hb_arena_T* arena);
void hb_arena_instrumentation_log_alloc(const hb_arena_T* arena, size_t allocation_size);
void hb_arena_instrumentation_log_reset(const hb_arena_T* arena, size_t reset_position);
void hb_arena_instrumentation_done(void);

#endif
