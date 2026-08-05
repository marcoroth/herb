#ifndef HERB_HASH_INDEX_MAP_H
#define HERB_HASH_INDEX_MAP_H

#include <stdbool.h>
#include <stddef.h>

#include "../lib/hb_allocator.h"
#include "herb_hash.h"

typedef struct {
  herb_hash_T key;
  size_t value;
  bool occupied;
} herb_hash_index_entry_T;

typedef struct {
  herb_hash_index_entry_T* entries;
  size_t capacity;
} herb_hash_index_map_T;

bool herb_hash_index_map_init(herb_hash_index_map_T* map, size_t count, hb_allocator_T* allocator);

void herb_hash_index_map_insert(herb_hash_index_map_T* map, herb_hash_T key, size_t value);

bool herb_hash_index_map_find_unmatched(
  const herb_hash_index_map_T* map,
  herb_hash_T key,
  const bool* matched,
  size_t* out_value
);

#endif
