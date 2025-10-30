#include <ruby.h>

#include "error_helpers.h"
#include "extension.h"
#include "extension_helpers.h"
#include "nodes.h"

#include "../../src/include/analyze.h"

VALUE mHerb;
VALUE cPosition;
VALUE cLocation;
VALUE cRange;
VALUE cToken;
VALUE cResult;
VALUE cLexResult;
VALUE cParseResult;

static VALUE Herb_lex(VALUE self, VALUE source) {
  char* string = (char*) check_string(source);

  hb_array_T* tokens = herb_lex(string);

  VALUE result = create_lex_result(tokens, source);

  herb_free_tokens(&tokens);

  return result;
}

static VALUE Herb_lex_file(VALUE self, VALUE path) {
  char* file_path = (char*) check_string(path);
  hb_array_T* tokens = herb_lex_file(file_path);

  VALUE source_value = read_file_to_ruby_string(file_path);
  VALUE result = create_lex_result(tokens, source_value);

  herb_free_tokens(&tokens);

  return result;
}

static VALUE Herb_parse(int argc, VALUE* argv, VALUE self) {
  VALUE source, options;
  rb_scan_args(argc, argv, "1:", &source, &options);

  char* string = (char*) check_string(source);

  parser_options_T* parser_options = NULL;
  parser_options_T opts = { 0 };

  if (!NIL_P(options)) {
    VALUE track_whitespace = rb_hash_lookup(options, rb_utf8_str_new_cstr("track_whitespace"));
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

static VALUE Herb_parse_file(VALUE self, VALUE path) {
  char* file_path = (char*) check_string(path);

  VALUE source_value = read_file_to_ruby_string(file_path);
  char* string = (char*) check_string(source_value);

  AST_DOCUMENT_NODE_T* root = herb_parse(string, NULL);

  VALUE result = create_parse_result(root, source_value);

  ast_node_free((AST_NODE_T*) root);

  return result;
}

static VALUE Herb_extract_ruby(VALUE self, VALUE source) {
  char* string = (char*) check_string(source);
  hb_buffer_T output;

  if (!hb_buffer_init(&output, strlen(string))) { return Qnil; }

  herb_extract_ruby_to_buffer(string, &output);

  VALUE result = rb_utf8_str_new_cstr(output.value);
  free(output.value);

  return result;
}

static VALUE Herb_extract_ruby_with_semicolons(VALUE self, VALUE source) {
  char* string = (char*) check_string(source);
  hb_buffer_T output;

  if (!hb_buffer_init(&output, strlen(string))) { return Qnil; }

  herb_extract_ruby_to_buffer_with_semicolons(string, &output);

  VALUE result = rb_utf8_str_new_cstr(output.value);
  free(output.value);

  return result;
}

static VALUE Herb_extract_html(VALUE self, VALUE source) {
  char* string = (char*) check_string(source);
  hb_buffer_T output;

  if (!hb_buffer_init(&output, strlen(string))) { return Qnil; }

  herb_extract_html_to_buffer(string, &output);

  VALUE result = rb_utf8_str_new_cstr(output.value);
  free(output.value);

  return result;
}

static VALUE Herb_version(VALUE self) {
  VALUE gem_version = rb_const_get(self, rb_intern("VERSION"));
  VALUE libherb_version = rb_utf8_str_new_cstr(herb_version());
  VALUE libprism_version = rb_utf8_str_new_cstr(herb_prism_version());
  VALUE format_string = rb_utf8_str_new_cstr("herb gem v%s, libprism v%s, libherb v%s (Ruby C native extension)");

  return rb_funcall(rb_mKernel, rb_intern("sprintf"), 4, format_string, gem_version, libprism_version, libherb_version);
}

void Init_herb(void) {
  mHerb = rb_define_module("Herb");
  cPosition = rb_define_class_under(mHerb, "Position", rb_cObject);
  cLocation = rb_define_class_under(mHerb, "Location", rb_cObject);
  cRange = rb_define_class_under(mHerb, "Range", rb_cObject);
  cToken = rb_define_class_under(mHerb, "Token", rb_cObject);
  cResult = rb_define_class_under(mHerb, "Result", rb_cObject);
  cLexResult = rb_define_class_under(mHerb, "LexResult", cResult);
  cParseResult = rb_define_class_under(mHerb, "ParseResult", cResult);

  rb_define_singleton_method(mHerb, "parse", Herb_parse, -1);
  rb_define_singleton_method(mHerb, "lex", Herb_lex, 1);
  rb_define_singleton_method(mHerb, "parse_file", Herb_parse_file, 1);
  rb_define_singleton_method(mHerb, "lex_file", Herb_lex_file, 1);
  rb_define_singleton_method(mHerb, "extract_ruby", Herb_extract_ruby, 1);
  rb_define_singleton_method(mHerb, "extract_ruby_with_semicolons", Herb_extract_ruby_with_semicolons, 1);
  rb_define_singleton_method(mHerb, "extract_html", Herb_extract_html, 1);
  rb_define_singleton_method(mHerb, "version", Herb_version, 0);
}
