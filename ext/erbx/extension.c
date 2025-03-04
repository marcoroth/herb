#include <ruby.h>

#include "extension.h"
#include "extension_helpers.h"
#include "nodes.h"

#include "../../src/include/erbx.h"
#include "../../src/include/token.h"

static VALUE ERBX_lex(VALUE self, VALUE source) {
  char* string = (char*) check_string(source);

  array_T* tokens = erbx_lex(string);

  return create_lex_result(tokens, source);
}

static VALUE ERBX_lex_file(VALUE self, VALUE path) {
  char* file_path = (char*) check_string(path);
  array_T* tokens = erbx_lex_file(file_path);

  VALUE source_value = read_file_to_ruby_string(file_path);

  return create_lex_result(tokens, source_value);
}

static VALUE ERBX_parse(VALUE self, VALUE source) {
  char* string = (char*) check_string(source);

  AST_DOCUMENT_NODE_T* root = erbx_parse(string);

  return create_parse_result(root, source);
}

static VALUE ERBX_parse_file(VALUE self, VALUE path) {
  char* file_path = (char*) check_string(path);

  VALUE source_value = read_file_to_ruby_string(file_path);
  char* string = (char*) check_string(source_value);

  AST_DOCUMENT_NODE_T* root = erbx_parse(string);

  return create_parse_result(root, source_value);
}

static VALUE ERBX_lex_to_json(VALUE self, VALUE source) {
  char* string = (char*) check_string(source);
  buffer_T output;

  if (!buffer_init(&output)) { return Qnil; }

  erbx_lex_json_to_buffer(string, &output);

  VALUE result = rb_str_new(output.value, output.length);

  buffer_free(&output);

  return result;
}

static VALUE ERBX_extract_ruby(VALUE self, VALUE source) {
  char* string = (char*) check_string(source);
  buffer_T output;

  if (!buffer_init(&output)) { return Qnil; }

  erbx_extract_ruby_to_buffer(string, &output);

  VALUE result = rb_str_new_cstr(output.value);
  buffer_free(&output);

  return result;
}

static VALUE ERBX_extract_html(VALUE self, VALUE source) {
  char* string = (char*) check_string(source);
  buffer_T output;

  if (!buffer_init(&output)) { return Qnil; }

  erbx_extract_html_to_buffer(string, &output);

  VALUE result = rb_str_new_cstr(output.value);
  buffer_free(&output);

  return result;
}

static VALUE ERBX_version(VALUE self) {
  VALUE gem_version = rb_const_get(self, rb_intern("VERSION"));
  VALUE liberbx_version = rb_str_new_cstr(erbx_version());
  VALUE format_string = rb_str_new_cstr("v%s (via liberbx v%s)");

  return rb_funcall(rb_mKernel, rb_intern("sprintf"), 3, format_string, gem_version, liberbx_version);
}

void Init_erbx(void) {
  VALUE ERBX = rb_define_module("ERBX");

  rb_define_singleton_method(ERBX, "parse", ERBX_parse, 1);
  rb_define_singleton_method(ERBX, "lex", ERBX_lex, 1);
  rb_define_singleton_method(ERBX, "parse_file", ERBX_parse_file, 1);
  rb_define_singleton_method(ERBX, "lex_file", ERBX_lex_file, 1);
  rb_define_singleton_method(ERBX, "lex_to_json", ERBX_lex_to_json, 1);
  rb_define_singleton_method(ERBX, "extract_ruby", ERBX_extract_ruby, 1);
  rb_define_singleton_method(ERBX, "extract_html", ERBX_extract_html, 1);
  rb_define_singleton_method(ERBX, "version", ERBX_version, 0);
}
