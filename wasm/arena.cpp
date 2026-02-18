#include "arena.h"

#include <stdlib.h>
#include <map>

extern "C" {
#include "../src/include/macros.h"
}

static std::map<int, hb_arena_T*> arena_registry;
static int next_arena_id = 1;

int Herb_createArena(int initial_size) {
  hb_arena_T* arena = (hb_arena_T*) malloc(sizeof(hb_arena_T));
  if (!arena) return -1;

  size_t size = initial_size > 0 ? (size_t) initial_size : KB(512);
  if (!hb_arena_init(arena, size)) {
    free(arena);
    return -1;
  }

  int id = next_arena_id++;
  arena_registry[id] = arena;
  return id;
}

void Herb_resetArena(int arena_id) {
  auto it = arena_registry.find(arena_id);

  if (it != arena_registry.end() && it->second) {
    hb_arena_reset(it->second);
  }
}

void Herb_freeArena(int arena_id) {
  auto it = arena_registry.find(arena_id);

  if (it != arena_registry.end() && it->second) {
    hb_arena_free(it->second);
    free(it->second);
    arena_registry.erase(it);
  }
}

int Herb_arenaPosition(int arena_id) {
  auto it = arena_registry.find(arena_id);

  if (it != arena_registry.end() && it->second) {
    return (int) hb_arena_position(it->second);
  }

  return -1;
}

int Herb_arenaCapacity(int arena_id) {
  auto it = arena_registry.find(arena_id);
  if (it != arena_registry.end() && it->second) {
    return (int) hb_arena_capacity(it->second);
  }
  return -1;
}

hb_arena_T* get_arena_by_id(int arena_id) {
  auto it = arena_registry.find(arena_id);
  if (it != arena_registry.end() && it->second) {
    return it->second;
  }
  return nullptr;
}
