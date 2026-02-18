#ifndef HERB_NODE_ARENA_H
#define HERB_NODE_ARENA_H

#include <node_api.h>

extern "C" {
#include "../extension/libherb/include/util/hb_arena.h"
}

extern napi_ref arena_constructor_ref;

napi_value Arena_constructor(napi_env env, napi_callback_info info);
napi_value Arena_reset(napi_env env, napi_callback_info info);
napi_value Arena_get_position(napi_env env, napi_callback_info info);
napi_value Arena_get_capacity(napi_env env, napi_callback_info info);
napi_value Arena_free(napi_env env, napi_callback_info info);

hb_arena_T* get_arena_from_value(napi_env env, napi_value arena_val);

typedef struct {
  hb_arena_T* arena;
  bool owns_arena;
} arena_context_T;

hb_arena_T* get_arena_option_from_object(napi_env env, napi_value options);
bool setup_arena_context(napi_env env, hb_arena_T* external_arena, arena_context_T* context);
void cleanup_arena_context(arena_context_T* context);

void Init_herb_arena(napi_env env, napi_value exports);

#endif
