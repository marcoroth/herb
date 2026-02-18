#ifndef HERB_EXT_ARENA_H
#define HERB_EXT_ARENA_H

#include "../../src/include/util/hb_arena.h"
#include <ruby.h>
#include <stdbool.h>

#include "../../src/include/lib/hb_allocator.h"
#include "../../src/include/lib/hb_arena.h"

extern VALUE cArena;
extern const rb_data_type_t herb_arena_type;

VALUE Arena_allocate(VALUE klass);
VALUE Arena_initialize(int argc, VALUE* argv, VALUE self);
VALUE Arena_reset(VALUE self);
VALUE Arena_position(VALUE self);
VALUE Arena_capacity(VALUE self);
VALUE Arena_stats(VALUE self);

hb_arena_T* get_arena_from_value(VALUE arena_obj);

VALUE get_arena_option_from_hash(VALUE options);
bool herb_arena_init_allocator(hb_allocator_T* allocator, VALUE external_arena);

void Init_herb_arena(VALUE mHerb);

#endif
