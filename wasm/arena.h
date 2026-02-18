#ifndef HERB_WASM_ARENA_H
#define HERB_WASM_ARENA_H

extern "C" {
#include "../src/include/util/hb_arena.h"
}

int Herb_createArena(int initial_size);
void Herb_resetArena(int arena_id);
void Herb_freeArena(int arena_id);
int Herb_arenaPosition(int arena_id);
int Herb_arenaCapacity(int arena_id);

hb_arena_T* get_arena_by_id(int arena_id);

#endif
