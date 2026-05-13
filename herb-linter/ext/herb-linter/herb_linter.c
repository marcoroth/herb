#include <ruby.h>

#include "herb_linter.h"

static VALUE Backend_lint(int argc, VALUE* argv, VALUE self) {
  VALUE source, config_json, file_name;
  rb_scan_args(argc, argv, "12", &source, &config_json, &file_name);

  Check_Type(source, T_STRING);

  const char* source_c_string = StringValueCStr(source);
  const char* config_c_string = NULL;
  const char* file_name_c_string = NULL;

  if (!NIL_P(config_json) && config_json != Qundef) {
    Check_Type(config_json, T_STRING);
    config_c_string = StringValueCStr(config_json);
  }

  if (!NIL_P(file_name) && file_name != Qundef) {
    Check_Type(file_name, T_STRING);
    file_name_c_string = StringValueCStr(file_name);
  }

  herb_lint_result_T* result = herb_lint(source_c_string, config_c_string, file_name_c_string);

  if (result == NULL) { return Qnil; }

  VALUE json_string = rb_utf8_str_new_cstr(result->json);
  VALUE rb_mJSON = rb_const_get(rb_cObject, rb_intern("JSON"));
  VALUE hash = rb_funcall(rb_mJSON, rb_intern("parse"), 1, json_string);

  herb_lint_result_free(result);

  return hash;
}

static VALUE Backend_rule_count(VALUE self) {
  size_t count = herb_lint_rule_count();

  return SIZET2NUM(count);
}

static VALUE Backend_rule_names(VALUE self) {
  size_t count = 0;
  char** names = herb_lint_rule_names(&count);

  VALUE array = rb_ary_new_capa((long) count);

  for (size_t index = 0; index < count; index++) {
    rb_ary_push(array, rb_utf8_str_new_cstr(names[index]));
  }

  herb_lint_rule_names_free(names, count);

  return array;
}

static VALUE Backend_available(VALUE self) {
  return Qtrue;
}

__attribute__((__visibility__("default"))) void Init_herb_linter(void) {
  VALUE mHerb = rb_define_module("Herb");
  VALUE cLinter = rb_define_class_under(mHerb, "Linter", rb_cObject);
  VALUE cBackend = rb_define_class_under(cLinter, "Backend", rb_cObject);

  rb_define_singleton_method(cBackend, "available?", Backend_available, 0);
  rb_define_singleton_method(cBackend, "lint", Backend_lint, -1);
  rb_define_singleton_method(cBackend, "rule_count", Backend_rule_count, 0);
  rb_define_singleton_method(cBackend, "rule_names", Backend_rule_names, 0);
}
