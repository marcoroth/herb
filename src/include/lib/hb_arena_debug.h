#ifndef HERB_ARENA_DEBUG_H
#define HERB_ARENA_DEBUG_H

#include "hb_arena.h"

typedef struct {
  size_t pages;
  size_t total_capacity;
  size_t total_used;
  size_t total_available;
  size_t allocations;
  size_t fragmentation;
  size_t default_page_size;
} hb_arena_stats_T;

hb_arena_stats_T hb_arena_get_stats(const hb_arena_T* arena);
void hb_arena_print_stats(const hb_arena_T* arena);

#endif
