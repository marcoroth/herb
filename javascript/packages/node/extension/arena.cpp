#include "arena.h"

#include <stdlib.h>

extern "C" {
#include "../extension/libherb/include/macros.h"
#include "../extension/libherb/include/util/hb_arena.h"
}

napi_ref arena_constructor_ref = nullptr;

typedef struct {
  hb_arena_T* arena;
  bool initialized;
} herb_arena_wrapper_T;

static void Arena_destructor(napi_env env, void* finalize_data, void* finalize_hint) {
  herb_arena_wrapper_T* wrapper = (herb_arena_wrapper_T*) finalize_data;
  if (wrapper->arena && wrapper->initialized) {
    hb_arena_free(wrapper->arena);
    free(wrapper->arena);
  }
  free(wrapper);
}

napi_value Arena_constructor(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_value this_val;
  napi_get_cb_info(env, info, &argc, args, &this_val, nullptr);

  size_t initial_size = KB(512);

  if (argc >= 1) {
    napi_valuetype valuetype;
    napi_typeof(env, args[0], &valuetype);

    if (valuetype == napi_object) {
      bool has_size_prop;
      napi_has_named_property(env, args[0], "size", &has_size_prop);

      if (has_size_prop) {
        napi_value size_prop;
        napi_get_named_property(env, args[0], "size", &size_prop);
        uint32_t size_value;
        napi_get_value_uint32(env, size_prop, &size_value);
        initial_size = (size_t) size_value;
      }
    }
  }

  herb_arena_wrapper_T* wrapper = (herb_arena_wrapper_T*) malloc(sizeof(herb_arena_wrapper_T));
  if (!wrapper) {
    napi_throw_error(env, nullptr, "Failed to allocate arena wrapper");
    return nullptr;
  }

  wrapper->arena = (hb_arena_T*) malloc(sizeof(hb_arena_T));
  if (!wrapper->arena) {
    free(wrapper);
    napi_throw_error(env, nullptr, "Failed to allocate arena");
    return nullptr;
  }

  if (!hb_arena_init(wrapper->arena, initial_size)) {
    free(wrapper->arena);
    free(wrapper);
    napi_throw_error(env, nullptr, "Failed to initialize arena");
    return nullptr;
  }

  wrapper->initialized = true;

  napi_wrap(env, this_val, wrapper, Arena_destructor, nullptr, nullptr);

  return this_val;
}

napi_value Arena_reset(napi_env env, napi_callback_info info) {
  napi_value this_val;
  napi_get_cb_info(env, info, nullptr, nullptr, &this_val, nullptr);

  herb_arena_wrapper_T* wrapper;
  napi_unwrap(env, this_val, (void**) &wrapper);

  if (!wrapper || !wrapper->arena || !wrapper->initialized) {
    napi_throw_error(env, nullptr, "Arena not initialized");
    return nullptr;
  }

  hb_arena_reset(wrapper->arena);

  return this_val;
}

napi_value Arena_get_position(napi_env env, napi_callback_info info) {
  napi_value this_val;
  napi_get_cb_info(env, info, nullptr, nullptr, &this_val, nullptr);

  herb_arena_wrapper_T* wrapper;
  napi_unwrap(env, this_val, (void**) &wrapper);

  if (!wrapper || !wrapper->arena || !wrapper->initialized) {
    napi_throw_error(env, nullptr, "Arena not initialized");
    return nullptr;
  }

  napi_value result;
  napi_create_uint32(env, (uint32_t) hb_arena_position(wrapper->arena), &result);
  return result;
}

napi_value Arena_get_capacity(napi_env env, napi_callback_info info) {
  napi_value this_val;
  napi_get_cb_info(env, info, nullptr, nullptr, &this_val, nullptr);

  herb_arena_wrapper_T* wrapper;
  napi_unwrap(env, this_val, (void**) &wrapper);

  if (!wrapper || !wrapper->arena || !wrapper->initialized) {
    napi_throw_error(env, nullptr, "Arena not initialized");
    return nullptr;
  }

  napi_value result;
  napi_create_uint32(env, (uint32_t) hb_arena_capacity(wrapper->arena), &result);
  return result;
}

napi_value Arena_free(napi_env env, napi_callback_info info) {
  napi_value this_val;
  napi_get_cb_info(env, info, nullptr, nullptr, &this_val, nullptr);

  herb_arena_wrapper_T* wrapper;
  napi_unwrap(env, this_val, (void**) &wrapper);

  if (!wrapper || !wrapper->arena || !wrapper->initialized) {
    napi_value undefined;
    napi_get_undefined(env, &undefined);
    return undefined;
  }

  hb_arena_free(wrapper->arena);
  free(wrapper->arena);
  wrapper->arena = nullptr;
  wrapper->initialized = false;

  napi_value undefined;
  napi_get_undefined(env, &undefined);
  return undefined;
}

hb_arena_T* get_arena_from_value(napi_env env, napi_value arena_val) {
  if (!arena_val) return nullptr;

  napi_valuetype valuetype;
  napi_typeof(env, arena_val, &valuetype);
  if (valuetype != napi_object) return nullptr;

  herb_arena_wrapper_T* wrapper;
  napi_status status = napi_unwrap(env, arena_val, (void**) &wrapper);
  if (status != napi_ok) return nullptr;

  if (!wrapper || !wrapper->arena || !wrapper->initialized) return nullptr;

  return wrapper->arena;
}

hb_arena_T* get_arena_option_from_object(napi_env env, napi_value options) {
  if (!options) return nullptr;

  napi_valuetype valuetype;
  napi_typeof(env, options, &valuetype);
  if (valuetype != napi_object) return nullptr;

  bool has_arena_prop;
  napi_has_named_property(env, options, "arena", &has_arena_prop);
  if (!has_arena_prop) return nullptr;

  napi_value arena_prop;
  napi_get_named_property(env, options, "arena", &arena_prop);
  return get_arena_from_value(env, arena_prop);
}

bool setup_arena_context(napi_env env, hb_arena_T* external_arena, arena_context_T* context) {
  if (external_arena) {
    context->arena = external_arena;
    context->owns_arena = false;
    return true;
  }

  context->arena = (hb_arena_T*) malloc(sizeof(hb_arena_T));
  if (!context->arena) { return false; }

  if (!hb_arena_init(context->arena, KB(512))) {
    free(context->arena);
    context->arena = nullptr;
    return false;
  }

  context->owns_arena = true;
  return true;
}

void cleanup_arena_context(arena_context_T* context) {
  if (context->owns_arena && context->arena) {
    hb_arena_free(context->arena);
    free(context->arena);
    context->arena = nullptr;
  }
}

void Init_herb_arena(napi_env env, napi_value exports) {
  napi_property_descriptor arena_properties[] = {
    { "reset", nullptr, Arena_reset, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "free", nullptr, Arena_free, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "position", nullptr, nullptr, Arena_get_position, nullptr, nullptr, napi_default, nullptr },
    { "capacity", nullptr, nullptr, Arena_get_capacity, nullptr, nullptr, napi_default, nullptr },
  };

  napi_value arena_class;
  napi_define_class(
    env,
    "Arena",
    NAPI_AUTO_LENGTH,
    Arena_constructor,
    nullptr,
    sizeof(arena_properties) / sizeof(arena_properties[0]),
    arena_properties,
    &arena_class
  );

  napi_create_reference(env, arena_class, 1, &arena_constructor_ref);
  napi_set_named_property(env, exports, "Arena", arena_class);
}
