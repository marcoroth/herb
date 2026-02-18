#ifndef HERB_WASM_ARENA_H
#define HERB_WASM_ARENA_H

#include <emscripten/val.h>

extern "C" {
#include "../src/include/lib/hb_allocator.h"
#include "../src/include/lib/hb_arena.h"
}

int Herb_createArena(int initial_size);
void Herb_resetArena(int arena_id);
void Herb_freeArena(int arena_id);
int Herb_arenaPosition(int arena_id);
int Herb_arenaCapacity(int arena_id);

hb_arena_T* get_arena_by_id(int arena_id);

hb_arena_T* get_arena_option_from_object(emscripten::val options);
bool herb_arena_init_allocator(hb_allocator_T& allocator, hb_arena_T* external_arena);

#endif
