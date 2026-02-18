#ifndef HERB_EXT_ARENA_H
#define HERB_EXT_ARENA_H

#include <ruby.h>
#include "../../src/include/util/hb_arena.h"

extern VALUE cArena;
extern const rb_data_type_t herb_arena_type;

VALUE Arena_allocate(VALUE klass);
VALUE Arena_initialize(int argc, VALUE* argv, VALUE self);
VALUE Arena_reset(VALUE self);
VALUE Arena_position(VALUE self);
VALUE Arena_capacity(VALUE self);
VALUE Arena_stats(VALUE self);

hb_arena_T* get_arena_from_value(VALUE arena_obj);

void Init_herb_arena(VALUE mHerb);

#endif
