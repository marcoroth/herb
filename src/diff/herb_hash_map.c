#include "../include/diff/herb_hash_map.h"

#include <string.h>

static size_t hash_pointer(const AST_NODE_T* node, const size_t capacity) {
  uintptr_t pointer_value = (uintptr_t) node;

  pointer_value = ((pointer_value >> 16) ^ pointer_value) * 0x45d9f3b;
  pointer_value = ((pointer_value >> 16) ^ pointer_value) * 0x45d9f3b;
  pointer_value = (pointer_value >> 16) ^ pointer_value;

  return (size_t) (pointer_value % capacity);
}

static bool herb_hash_map_grow(herb_hash_map_T* map) {
  const size_t new_capacity = map->capacity * 2;
  const size_t alloc_size = new_capacity * sizeof(herb_hash_map_entry_T);

  herb_hash_map_entry_T* new_entries = (herb_hash_map_entry_T*) hb_allocator_alloc(map->allocator, alloc_size);

  if (new_entries == NULL) { return false; }

  memset(new_entries, 0, alloc_size);

  for (size_t index = 0; index < map->capacity; index++) {
    if (!map->entries[index].occupied) { continue; }

    size_t slot = hash_pointer(map->entries[index].node, new_capacity);

    while (new_entries[slot].occupied) {
      slot = (slot + 1) % new_capacity;
    }

    new_entries[slot] = map->entries[index];
  }

  map->entries = new_entries;
  map->capacity = new_capacity;

  return true;
}

bool herb_hash_map_init(herb_hash_map_T* map, const size_t initial_capacity, hb_allocator_T* allocator) {
  const size_t alloc_size = initial_capacity * sizeof(herb_hash_map_entry_T);

  map->entries = (herb_hash_map_entry_T*) hb_allocator_alloc(allocator, alloc_size);

  if (map->entries == NULL) { return false; }

  memset(map->entries, 0, alloc_size);
  map->capacity = initial_capacity;
  map->size = 0;
  map->allocator = allocator;

  return true;
}

void herb_hash_map_set(herb_hash_map_T* map, const AST_NODE_T* node, const herb_hash_T hash) {
  if (map->size * 4 >= map->capacity * 3) { herb_hash_map_grow(map); }

  size_t slot = hash_pointer(node, map->capacity);

  while (map->entries[slot].occupied) {
    if (map->entries[slot].node == node) {
      map->entries[slot].hash = hash;
      return;
    }

    slot = (slot + 1) % map->capacity;
  }

  map->entries[slot].node = node;
  map->entries[slot].hash = hash;
  map->entries[slot].occupied = true;
  map->size++;
}

herb_hash_T herb_hash_map_get(const herb_hash_map_T* map, const AST_NODE_T* node) {
  if (node == NULL || map->size == 0) { return HERB_HASH_INIT; }

  size_t slot = hash_pointer(node, map->capacity);

  while (map->entries[slot].occupied) {
    if (map->entries[slot].node == node) { return map->entries[slot].hash; }

    slot = (slot + 1) % map->capacity;
  }

  return HERB_HASH_INIT;
}

bool herb_hash_map_has(const herb_hash_map_T* map, const AST_NODE_T* node) {
  if (node == NULL || map->size == 0) { return false; }

  size_t slot = hash_pointer(node, map->capacity);

  while (map->entries[slot].occupied) {
    if (map->entries[slot].node == node) { return true; }

    slot = (slot + 1) % map->capacity;
  }

  return false;
}
