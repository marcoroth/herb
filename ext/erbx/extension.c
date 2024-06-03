#include "ruby.h"
#include "extconf.h"
#include "extension.h"

#include "../../src/include/erbx.h"

static const char *check_string(VALUE value) {
  if (NIL_P(value)) {
    return NULL;
  }

  if (!RB_TYPE_P(value, T_STRING)) {
    rb_raise(rb_eTypeError, "wrong argument type %" PRIsVALUE " (expected String)", rb_obj_class(value));
  }

  return RSTRING_PTR(value);
}

VALUE rb_erbx_compile(VALUE self, VALUE source) {
  const char *string = check_string(source);

  erbx_compile((char *) string);

  return Qnil;
}

void Init_erbx() {
  VALUE ERBX = rb_define_module("ERBX");
  VALUE Compiler = rb_define_class_under(ERBX, "Compiler", rb_cObject);

  rb_define_method(Compiler, "compile", rb_erbx_compile, 1);
}
