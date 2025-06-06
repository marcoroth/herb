#include <ruby.h>

#include "error_helpers.h"
#include "extension_helpers.h"
#include "nodes.h"

#include "../../src/include/analyze.h"

static VALUE Herb_lex(VALUE self, VALUE source) {
  char* string = (char*) check_string(source);

  array_T* tokens = herb_lex(string);

  VALUE result = create_lex_result(tokens, source);

  herb_free_tokens(&tokens);

  return result;
}

static VALUE Herb_lex_file(VALUE self, VALUE path) {
  char* file_path = (char*) check_string(path);
  array_T* tokens = herb_lex_file(file_path);

  VALUE source_value = read_file_to_ruby_string(file_path);
  VALUE result = create_lex_result(tokens, source_value);

  herb_free_tokens(&tokens);

  return result;
}

static VALUE Herb_parse(VALUE self, VALUE source) {
  char* string = (char*) check_string(source);

  AST_DOCUMENT_NODE_T* root = herb_parse(string);

  herb_analyze_parse_tree(root, string);

  VALUE result = create_parse_result(root, source);

  ast_node_free((AST_NODE_T*) root);

  return result;
}

static VALUE Herb_parse_file(VALUE self, VALUE path) {
  char* file_path = (char*) check_string(path);

  VALUE source_value = read_file_to_ruby_string(file_path);
  char* string = (char*) check_string(source_value);

  AST_DOCUMENT_NODE_T* root = herb_parse(string);

  VALUE result = create_parse_result(root, source_value);

  ast_node_free((AST_NODE_T*) root);

  return result;
}

static VALUE Herb_lex_to_json(VALUE self, VALUE source) {
  char* string = (char*) check_string(source);
  buffer_T output;

  if (!buffer_init(&output)) { return Qnil; }

  herb_lex_json_to_buffer(string, &output);

  VALUE result = rb_str_new(output.value, output.length);

  buffer_free(&output);

  return result;
}

static VALUE Herb_extract_ruby(VALUE self, VALUE source) {
  char* string = (char*) check_string(source);
  buffer_T output;

  if (!buffer_init(&output)) { return Qnil; }

  herb_extract_ruby_to_buffer(string, &output);

  VALUE result = rb_str_new_cstr(output.value);
  buffer_free(&output);

  return result;
}

static VALUE Herb_extract_html(VALUE self, VALUE source) {
  char* string = (char*) check_string(source);
  buffer_T output;

  if (!buffer_init(&output)) { return Qnil; }

  herb_extract_html_to_buffer(string, &output);

  VALUE result = rb_str_new_cstr(output.value);
  buffer_free(&output);

  return result;
}

static VALUE Herb_version(VALUE self) {
  VALUE gem_version = rb_const_get(self, rb_intern("VERSION"));
  VALUE libherb_version = rb_str_new_cstr(herb_version());
  VALUE libprism_version = rb_str_new_cstr(herb_prism_version());
  VALUE format_string = rb_str_new_cstr("herb gem v%s, libprism v%s, libherb v%s (Ruby C native extension)");

  return rb_funcall(rb_mKernel, rb_intern("sprintf"), 4, format_string, gem_version, libprism_version, libherb_version);
}

void Init_herb(void) {
  VALUE Herb = rb_define_module("Herb");

  rb_define_singleton_method(Herb, "parse", Herb_parse, 1);
  rb_define_singleton_method(Herb, "lex", Herb_lex, 1);
  rb_define_singleton_method(Herb, "parse_file", Herb_parse_file, 1);
  rb_define_singleton_method(Herb, "lex_file", Herb_lex_file, 1);
  rb_define_singleton_method(Herb, "lex_to_json", Herb_lex_to_json, 1);
  rb_define_singleton_method(Herb, "extract_ruby", Herb_extract_ruby, 1);
  rb_define_singleton_method(Herb, "extract_html", Herb_extract_html, 1);
  rb_define_singleton_method(Herb, "version", Herb_version, 0);
}
