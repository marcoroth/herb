#include "../include/diff/herb_hash_index_map.h"

#include <string.h>

bool herb_hash_index_map_init(herb_hash_index_map_T* map, size_t count, hb_allocator_T* allocator) {
  map->capacity = count < 4 ? 8 : count * 3;
  size_t alloc_size = map->capacity * sizeof(herb_hash_index_entry_T);
  map->entries = (herb_hash_index_entry_T*) hb_allocator_alloc(allocator, alloc_size);

  if (map->entries == NULL) { return false; }

  memset(map->entries, 0, alloc_size);

  return true;
}

void herb_hash_index_map_insert(herb_hash_index_map_T* map, herb_hash_T key, size_t value) {
  size_t slot = (size_t) (key % map->capacity);

  while (map->entries[slot].occupied) {
    slot = (slot + 1) % map->capacity;
  }

  map->entries[slot].key = key;
  map->entries[slot].value = value;
  map->entries[slot].occupied = true;
}

bool herb_hash_index_map_find_unmatched(
  const herb_hash_index_map_T* map,
  herb_hash_T key,
  const bool* matched,
  size_t* out_value
) {
  size_t slot = (size_t) (key % map->capacity);

  while (map->entries[slot].occupied) {
    if (map->entries[slot].key == key && !matched[map->entries[slot].value]) {
      *out_value = map->entries[slot].value;
      return true;
    }

    slot = (slot + 1) % map->capacity;
  }

  return false;
}
