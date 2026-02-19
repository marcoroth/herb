#ifndef HERB_WASM_ARENA_H
#define HERB_WASM_ARENA_H

#include <emscripten/val.h>

extern "C" {
#include "../src/include/util/hb_arena.h"
}

int Herb_createArena(int initial_size);
void Herb_resetArena(int arena_id);
void Herb_freeArena(int arena_id);
int Herb_arenaPosition(int arena_id);
int Herb_arenaCapacity(int arena_id);

hb_arena_T* get_arena_by_id(int arena_id);

typedef struct {
  hb_arena_T* arena;
  bool owns_arena;
} arena_context_T;

hb_arena_T* get_arena_option_from_object(emscripten::val options);
bool setup_arena_context(hb_arena_T* external_arena, arena_context_T* context);
void cleanup_arena_context(arena_context_T* context);

#endif
