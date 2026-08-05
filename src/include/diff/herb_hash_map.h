#ifndef HERB_HASH_MAP_H
#define HERB_HASH_MAP_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "../ast/ast_nodes.h"
#include "../lib/hb_allocator.h"
#include "herb_hash.h"

typedef struct {
  const AST_NODE_T* node;
  herb_hash_T hash;
  bool occupied;
} herb_hash_map_entry_T;

typedef struct {
  herb_hash_map_entry_T* entries;
  size_t capacity;
  size_t size;
  hb_allocator_T* allocator;
} herb_hash_map_T;

bool herb_hash_map_init(herb_hash_map_T* map, size_t initial_capacity, hb_allocator_T* allocator);
void herb_hash_map_set(herb_hash_map_T* map, const AST_NODE_T* node, herb_hash_T hash);
herb_hash_T herb_hash_map_get(const herb_hash_map_T* map, const AST_NODE_T* node);
bool herb_hash_map_has(const herb_hash_map_T* map, const AST_NODE_T* node);

#endif
