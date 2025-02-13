#include "extension.h"
#include "extconf.h"
#include "ruby.h"

#include "../../src/include/erbx.h"

static const char* check_string(VALUE value) {
  if (NIL_P(value)) {
    return NULL;
  }

  if (!RB_TYPE_P(value, T_STRING)) {
    rb_raise(rb_eTypeError, "wrong argument type %" PRIsVALUE " (expected String)", rb_obj_class(value));
  }

  return RSTRING_PTR(value);
}

VALUE rb_erbx_lex(VALUE self, VALUE source) {
  const char* string = check_string(source);

  erbx_lex((char*) string);

  return Qnil;
}

VALUE rb_erbx_extract_ruby(VALUE self, VALUE source) {
  const char* string = check_string(source);
  const char* ruby = erbx_extract_ruby((char*) string);

  return RSTRING_PTR(ruby);
}

void Init_erbx() {
  VALUE ERBX = rb_define_module("LibERBX");
  VALUE Lexer = rb_define_class_under(ERBX, "Lexer", rb_cObject);
  VALUE Extractor = rb_define_class_under(ERBX, "Extractor", rb_cObject);

  rb_define_method(Lexer, "lex", rb_erbx_lex, 1);
  rb_define_method(Extractor, "extract_ruby", rb_erbx_extract_ruby, 0);
}
