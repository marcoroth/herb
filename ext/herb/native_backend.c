#include <ruby.h>

#include "error_helpers.h"
#include "extension.h"
#include "extension_helpers.h"
#include "nodes.h"

#include "../../src/include/analyze.h"

VALUE cNativeBackend;

static VALUE NativeBackend_perform_lex(VALUE self, VALUE source) {
  char* string = (char*) check_string(source);

  array_T* tokens = herb_lex(string);

  VALUE result = create_lex_result(tokens, source);

  herb_free_tokens(&tokens);

  return result;
}

static VALUE NativeBackend_perform_lex_file(VALUE self, VALUE path) {
  char* file_path = (char*) check_string(path);
  array_T* tokens = herb_lex_file(file_path);

  VALUE source_value = read_file_to_ruby_string(file_path);
  VALUE result = create_lex_result(tokens, source_value);

  herb_free_tokens(&tokens);

  return result;
}

static VALUE NativeBackend_perform_parse(VALUE self, VALUE source, VALUE options) {
  char* string = (char*) check_string(source);

  parser_options_T* parser_options = NULL;
  parser_options_T opts = { 0 };

  if (!NIL_P(options)) {
    VALUE track_whitespace = rb_hash_lookup(options, rb_str_new_cstr("track_whitespace"));
    if (NIL_P(track_whitespace)) { track_whitespace = rb_hash_lookup(options, ID2SYM(rb_intern("track_whitespace"))); }

    if (!NIL_P(track_whitespace) && RTEST(track_whitespace)) {
      opts.track_whitespace = true;
      parser_options = &opts;
    }
  }

  AST_DOCUMENT_NODE_T* root = herb_parse(string, parser_options);

  herb_analyze_parse_tree(root, string);

  VALUE result = create_parse_result(root, source);

  ast_node_free((AST_NODE_T*) root);

  return result;
}

static VALUE NativeBackend_perform_parse_file(VALUE self, VALUE path, VALUE options) {
  char* file_path = (char*) check_string(path);

  VALUE source_value = read_file_to_ruby_string(file_path);
  char* string = (char*) check_string(source_value);

  parser_options_T* parser_options = NULL;
  parser_options_T opts = { 0 };

  if (!NIL_P(options)) {
    VALUE track_whitespace = rb_hash_lookup(options, rb_str_new_cstr("track_whitespace"));
    if (NIL_P(track_whitespace)) { track_whitespace = rb_hash_lookup(options, ID2SYM(rb_intern("track_whitespace"))); }

    if (!NIL_P(track_whitespace) && RTEST(track_whitespace)) {
      opts.track_whitespace = true;
      parser_options = &opts;
    }
  }

  AST_DOCUMENT_NODE_T* root = herb_parse(string, parser_options);

  herb_analyze_parse_tree(root, string);

  VALUE result = create_parse_result(root, source_value);

  ast_node_free((AST_NODE_T*) root);

  return result;
}

static VALUE NativeBackend_perform_extract_ruby(VALUE self, VALUE source) {
  char* string = (char*) check_string(source);
  buffer_T output;

  if (!buffer_init(&output)) { return Qnil; }

  herb_extract_ruby_to_buffer(string, &output);

  VALUE result = rb_str_new_cstr(output.value);
  buffer_free(&output);

  return result;
}

static VALUE NativeBackend_perform_extract_html(VALUE self, VALUE source) {
  char* string = (char*) check_string(source);
  buffer_T output;

  if (!buffer_init(&output)) { return Qnil; }

  herb_extract_html_to_buffer(string, &output);

  VALUE result = rb_str_new_cstr(output.value);
  buffer_free(&output);

  return result;
}

static VALUE NativeBackend_backend_version(VALUE self) {
  VALUE mHerb = rb_const_get(rb_cObject, rb_intern("Herb"));
  VALUE gem_version = rb_const_get(mHerb, rb_intern("VERSION"));
  VALUE libherb_version = rb_str_new_cstr(herb_version());
  VALUE libprism_version = rb_str_new_cstr(herb_prism_version());
  VALUE format_string = rb_str_new_cstr("herb gem v%s, native backend (libprism v%s, libherb v%s via C extension)");

  return rb_funcall(rb_mKernel, rb_intern("sprintf"), 4, format_string, gem_version, libprism_version, libherb_version);
}

void Init_native_backend(void) {
  VALUE mHerb = rb_const_get(rb_cObject, rb_intern("Herb"));
  VALUE mBackends = rb_const_get(mHerb, rb_intern("Backends"));

  cNativeBackend = rb_const_get(mBackends, rb_intern("NativeBackend"));

  rb_define_protected_method(cNativeBackend, "c_perform_lex", NativeBackend_perform_lex, 1);
  rb_define_protected_method(cNativeBackend, "c_perform_lex_file", NativeBackend_perform_lex_file, 1);
  rb_define_protected_method(cNativeBackend, "c_perform_parse", NativeBackend_perform_parse, 2);
  rb_define_protected_method(cNativeBackend, "c_perform_parse_file", NativeBackend_perform_parse_file, 2);
  rb_define_protected_method(cNativeBackend, "c_perform_extract_ruby", NativeBackend_perform_extract_ruby, 1);
  rb_define_protected_method(cNativeBackend, "c_perform_extract_html", NativeBackend_perform_extract_html, 1);
  rb_define_protected_method(cNativeBackend, "c_backend_version", NativeBackend_backend_version, 0);
}
