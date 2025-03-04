#include <ruby.h>

#include "extension.h"
#include "extension_helpers.h"
#include "nodes.h"

#include "../../src/include/ast_pretty_print.h"
#include "../../src/include/erbx.h"
#include "../../src/include/token.h"

const char* check_string(VALUE value) {
  if (NIL_P(value)) { return NULL; }

  if (!RB_TYPE_P(value, T_STRING)) {
    rb_raise(rb_eTypeError, "wrong argument type %" PRIsVALUE " (expected String)", rb_obj_class(value));
  }

  return RSTRING_PTR(value);
}

VALUE rb_location_from_c_struct(location_T* location) {
  if (!location) { return Qnil; }

  VALUE args[2];
  args[0] = SIZET2NUM(location->line);
  args[1] = SIZET2NUM(location->column);

  VALUE ERBX = rb_define_module("ERBX");
  VALUE Location = rb_define_class_under(ERBX, "Location", rb_cObject);

  return rb_class_new_instance(2, args, Location);
}

VALUE rb_range_from_c_struct(range_T* range) {
  if (!range) { return Qnil; }

  VALUE args[2];
  args[0] = SIZET2NUM(range->start);
  args[1] = SIZET2NUM(range->end);

  VALUE ERBX = rb_define_module("ERBX");
  VALUE Range = rb_define_class_under(ERBX, "Range", rb_cObject);

  return rb_class_new_instance(2, args, Range);
}

VALUE rb_token_from_c_struct(token_T* token) {
  if (!token) { return Qnil; }

  VALUE value = token->value ? rb_str_new_cstr(token->value) : Qnil;

  VALUE range = rb_range_from_c_struct(token->range);
  VALUE start = rb_location_from_c_struct(token->start);
  VALUE end = rb_location_from_c_struct(token->end);
  VALUE type = rb_str_new_cstr(token_type_to_string(token->type));

  VALUE args[5] = { value, range, start, end, type };

  VALUE ERBX = rb_define_module("ERBX");
  VALUE Token = rb_define_class_under(ERBX, "Token", rb_cObject);

  return rb_class_new_instance(5, args, Token);
}
