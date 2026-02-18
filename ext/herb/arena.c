#include <ruby.h>

#include "../../src/include/macros.h"
#include "../../src/include/util/hb_arena.h"
#include "../../src/include/util/hb_arena_debug.h"

#include "arena.h"

VALUE cArena;

typedef struct {
  hb_arena_T* arena;
  bool initialized;
} herb_arena_wrapper_T;

static void herb_arena_free(void* data) {
  herb_arena_wrapper_T* wrapper = (herb_arena_wrapper_T*) data;
  if (wrapper->arena && wrapper->initialized) {
    hb_arena_free(wrapper->arena);
    free(wrapper->arena);
  }
  free(wrapper);
}

static size_t herb_arena_memsize(const void* data) {
  const herb_arena_wrapper_T* wrapper = (const herb_arena_wrapper_T*) data;
  if (wrapper->arena && wrapper->initialized) {
    return sizeof(herb_arena_wrapper_T) + hb_arena_capacity(wrapper->arena);
  }
  return sizeof(herb_arena_wrapper_T);
}

const rb_data_type_t herb_arena_type = {
  .wrap_struct_name = "Herb::Arena",
  .function = {
    .dmark = NULL,
    .dfree = herb_arena_free,
    .dsize = herb_arena_memsize,
  },
  .flags = RUBY_TYPED_FREE_IMMEDIATELY,
};

VALUE Arena_allocate(VALUE klass) {
  herb_arena_wrapper_T* wrapper = malloc(sizeof(herb_arena_wrapper_T));
  wrapper->arena = NULL;
  wrapper->initialized = false;
  return TypedData_Wrap_Struct(klass, &herb_arena_type, wrapper);
}

VALUE Arena_initialize(int argc, VALUE* argv, VALUE self) {
  VALUE options;
  rb_scan_args(argc, argv, "0:", &options);

  size_t initial_size = KB(512);

  if (!NIL_P(options)) {
    VALUE size_val = rb_hash_lookup(options, rb_utf8_str_new_cstr("size"));
    if (NIL_P(size_val)) { size_val = rb_hash_lookup(options, ID2SYM(rb_intern("size"))); }
    if (!NIL_P(size_val)) { initial_size = NUM2SIZET(size_val); }
  }

  herb_arena_wrapper_T* wrapper;
  TypedData_Get_Struct(self, herb_arena_wrapper_T, &herb_arena_type, wrapper);

  wrapper->arena = malloc(sizeof(hb_arena_T));
  if (!wrapper->arena) {
    rb_raise(rb_eNoMemError, "Failed to allocate arena");
  }

  if (!hb_arena_init(wrapper->arena, initial_size)) {
    free(wrapper->arena);
    wrapper->arena = NULL;
    rb_raise(rb_eRuntimeError, "Failed to initialize arena");
  }

  wrapper->initialized = true;
  return self;
}

VALUE Arena_reset(VALUE self) {
  herb_arena_wrapper_T* wrapper;
  TypedData_Get_Struct(self, herb_arena_wrapper_T, &herb_arena_type, wrapper);

  if (!wrapper->arena || !wrapper->initialized) {
    rb_raise(rb_eRuntimeError, "Arena not initialized");
  }

  hb_arena_reset(wrapper->arena);
  return self;
}

VALUE Arena_position(VALUE self) {
  herb_arena_wrapper_T* wrapper;
  TypedData_Get_Struct(self, herb_arena_wrapper_T, &herb_arena_type, wrapper);

  if (!wrapper->arena || !wrapper->initialized) {
    rb_raise(rb_eRuntimeError, "Arena not initialized");
  }

  return SIZET2NUM(hb_arena_position(wrapper->arena));
}

VALUE Arena_capacity(VALUE self) {
  herb_arena_wrapper_T* wrapper;
  TypedData_Get_Struct(self, herb_arena_wrapper_T, &herb_arena_type, wrapper);

  if (!wrapper->arena || !wrapper->initialized) {
    rb_raise(rb_eRuntimeError, "Arena not initialized");
  }

  return SIZET2NUM(hb_arena_capacity(wrapper->arena));
}

VALUE Arena_stats(VALUE self) {
  herb_arena_wrapper_T* wrapper;
  TypedData_Get_Struct(self, herb_arena_wrapper_T, &herb_arena_type, wrapper);

  if (!wrapper->arena || !wrapper->initialized) {
    rb_raise(rb_eRuntimeError, "Arena not initialized");
  }

  hb_arena_print_stats(wrapper->arena);
  return Qnil;
}

hb_arena_T* get_arena_from_value(VALUE arena_obj) {
  if (NIL_P(arena_obj)) return NULL;

  herb_arena_wrapper_T* wrapper;
  TypedData_Get_Struct(arena_obj, herb_arena_wrapper_T, &herb_arena_type, wrapper);

  if (!wrapper->arena || !wrapper->initialized) {
    rb_raise(rb_eRuntimeError, "Arena not initialized");
  }

  return wrapper->arena;
}

VALUE get_arena_option_from_hash(VALUE options) {
  if (NIL_P(options)) return Qnil;

  VALUE arena = rb_hash_lookup(options, rb_utf8_str_new_cstr("arena"));
  if (NIL_P(arena)) { arena = rb_hash_lookup(options, ID2SYM(rb_intern("arena"))); }

  return arena;
}

bool setup_arena_context(VALUE external_arena, arena_context_T* context) {
  if (!NIL_P(external_arena)) {
    context->arena = get_arena_from_value(external_arena);
    context->owns_arena = false;
    return true;
  }

  context->arena = malloc(sizeof(hb_arena_T));
  if (!context->arena) { return false; }

  if (!hb_arena_init(context->arena, KB(512))) {
    free(context->arena);
    context->arena = NULL;
    return false;
  }

  context->owns_arena = true;
  return true;
}

void cleanup_arena_context(arena_context_T* context) {
  if (context->owns_arena && context->arena) {
    hb_arena_free(context->arena);
    free(context->arena);
    context->arena = NULL;
  }
}

void Init_herb_arena(VALUE mHerb) {
  cArena = rb_define_class_under(mHerb, "Arena", rb_cObject);
  rb_define_alloc_func(cArena, Arena_allocate);
  rb_define_method(cArena, "initialize", Arena_initialize, -1);
  rb_define_method(cArena, "reset", Arena_reset, 0);
  rb_define_method(cArena, "position", Arena_position, 0);
  rb_define_method(cArena, "capacity", Arena_capacity, 0);
  rb_define_method(cArena, "stats", Arena_stats, 0);
}
