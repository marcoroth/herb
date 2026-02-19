#include <ruby.h>

#include "arena.h"
#include "error_helpers.h"
#include "extension.h"
#include "extension_helpers.h"
#include "nodes.h"

#include "../../src/include/macros.h"
#include "../../src/include/util/hb_arena.h"
#include "../../src/include/util/hb_arena_debug.h"

VALUE mHerb;
VALUE cPosition;
VALUE cLocation;
VALUE cRange;
VALUE cToken;
VALUE cResult;
VALUE cLexResult;
VALUE cParseResult;

static VALUE Herb_lex(int argc, VALUE* argv, VALUE self) {
  VALUE source, options;
  rb_scan_args(argc, argv, "1:", &source, &options);

  char* string = (char*) check_string(source);
  bool print_arena_stats = false;

  if (!NIL_P(options)) {
    VALUE arena_stats = rb_hash_lookup(options, rb_utf8_str_new_cstr("arena_stats"));
    if (NIL_P(arena_stats)) { arena_stats = rb_hash_lookup(options, ID2SYM(rb_intern("arena_stats"))); }
    if (!NIL_P(arena_stats) && RTEST(arena_stats)) { print_arena_stats = true; }
  }

  arena_context_T context;
  if (!setup_arena_context(get_arena_option_from_hash(options), &context)) { return Qnil; }

  herb_lex_result_T* lex_result = herb_lex(string, context.arena);

  if (!lex_result) {
    cleanup_arena_context(&context);
    return Qnil;
  }

  VALUE result = create_lex_result(lex_result->tokens, source);

  if (print_arena_stats) { hb_arena_print_stats(context.arena); }

  herb_free_lex_result(&lex_result);

  return result;
}

static VALUE Herb_lex_file(int argc, VALUE* argv, VALUE self) {
  VALUE path, options;
  rb_scan_args(argc, argv, "1:", &path, &options);

  char* file_path = (char*) check_string(path);
  bool print_arena_stats = false;

  if (!NIL_P(options)) {
    VALUE arena_stats = rb_hash_lookup(options, rb_utf8_str_new_cstr("arena_stats"));
    if (NIL_P(arena_stats)) { arena_stats = rb_hash_lookup(options, ID2SYM(rb_intern("arena_stats"))); }
    if (!NIL_P(arena_stats) && RTEST(arena_stats)) { print_arena_stats = true; }
  }

  arena_context_T context;
  if (!setup_arena_context(get_arena_option_from_hash(options), &context)) { return Qnil; }

  herb_lex_result_T* lex_result = herb_lex_file(file_path, context.arena);

  if (!lex_result) {
    cleanup_arena_context(&context);
    return Qnil;
  }

  VALUE source_value = read_file_to_ruby_string(file_path);
  VALUE result = create_lex_result(lex_result->tokens, source_value);

  if (print_arena_stats) { hb_arena_print_stats(context.arena); }

  herb_free_lex_result(&lex_result);

  return result;
}

static VALUE Herb_parse(int argc, VALUE* argv, VALUE self) {
  VALUE source, options;
  rb_scan_args(argc, argv, "1:", &source, &options);

  char* string = (char*) check_string(source);

  parser_options_T parser_options = HERB_DEFAULT_PARSER_OPTIONS;
  bool print_arena_stats = false;

  if (!NIL_P(options)) {
    VALUE track_whitespace = rb_hash_lookup(options, rb_utf8_str_new_cstr("track_whitespace"));
    if (NIL_P(track_whitespace)) { track_whitespace = rb_hash_lookup(options, ID2SYM(rb_intern("track_whitespace"))); }
    if (!NIL_P(track_whitespace) && RTEST(track_whitespace)) { parser_options.track_whitespace = true; }

    VALUE analyze = rb_hash_lookup(options, rb_utf8_str_new_cstr("analyze"));
    if (NIL_P(analyze)) { analyze = rb_hash_lookup(options, ID2SYM(rb_intern("analyze"))); }
    if (!NIL_P(analyze) && !RTEST(analyze)) { parser_options.analyze = false; }

    VALUE strict = rb_hash_lookup(options, rb_utf8_str_new_cstr("strict"));
    if (NIL_P(strict)) { strict = rb_hash_lookup(options, ID2SYM(rb_intern("strict"))); }
    if (!NIL_P(strict)) { parser_options.strict = RTEST(strict); }

    VALUE arena_stats = rb_hash_lookup(options, rb_utf8_str_new_cstr("arena_stats"));
    if (NIL_P(arena_stats)) { arena_stats = rb_hash_lookup(options, ID2SYM(rb_intern("arena_stats"))); }
    if (!NIL_P(arena_stats) && RTEST(arena_stats)) { print_arena_stats = true; }
  }

  arena_context_T context;
  if (!setup_arena_context(get_arena_option_from_hash(options), &context)) { return Qnil; }

  AST_DOCUMENT_NODE_T* root = herb_parse(string, &parser_options, context.arena);

  if (!root) {
    cleanup_arena_context(&context);
    return Qnil;
  }

  root->owns_arena = context.owns_arena;

  VALUE result = create_parse_result(root, source);

  if (print_arena_stats) { hb_arena_print_stats(context.arena); }

  ast_node_free((AST_NODE_T*) root);

  return result;
}

static VALUE Herb_parse_file(int argc, VALUE* argv, VALUE self) {
  VALUE path, options;
  rb_scan_args(argc, argv, "1:", &path, &options);

  char* file_path = (char*) check_string(path);

  VALUE source_value = read_file_to_ruby_string(file_path);
  char* string = (char*) check_string(source_value);

  parser_options_T parser_options = HERB_DEFAULT_PARSER_OPTIONS;
  bool print_arena_stats = false;

  if (!NIL_P(options)) {
    VALUE track_whitespace = rb_hash_lookup(options, rb_utf8_str_new_cstr("track_whitespace"));
    if (NIL_P(track_whitespace)) { track_whitespace = rb_hash_lookup(options, ID2SYM(rb_intern("track_whitespace"))); }
    if (!NIL_P(track_whitespace) && RTEST(track_whitespace)) { parser_options.track_whitespace = true; }

    VALUE analyze = rb_hash_lookup(options, rb_utf8_str_new_cstr("analyze"));
    if (NIL_P(analyze)) { analyze = rb_hash_lookup(options, ID2SYM(rb_intern("analyze"))); }
    if (!NIL_P(analyze) && !RTEST(analyze)) { parser_options.analyze = false; }

    VALUE strict = rb_hash_lookup(options, rb_utf8_str_new_cstr("strict"));
    if (NIL_P(strict)) { strict = rb_hash_lookup(options, ID2SYM(rb_intern("strict"))); }
    if (!NIL_P(strict)) { parser_options.strict = RTEST(strict); }

    VALUE arena_stats = rb_hash_lookup(options, rb_utf8_str_new_cstr("arena_stats"));
    if (NIL_P(arena_stats)) { arena_stats = rb_hash_lookup(options, ID2SYM(rb_intern("arena_stats"))); }
    if (!NIL_P(arena_stats) && RTEST(arena_stats)) { print_arena_stats = true; }
  }

  arena_context_T context;
  if (!setup_arena_context(get_arena_option_from_hash(options), &context)) { return Qnil; }

  AST_DOCUMENT_NODE_T* root = herb_parse(string, &parser_options, context.arena);

  if (!root) {
    cleanup_arena_context(&context);
    return Qnil;
  }

  root->owns_arena = context.owns_arena;

  VALUE result = create_parse_result(root, source_value);

  if (print_arena_stats) { hb_arena_print_stats(context.arena); }

  ast_node_free((AST_NODE_T*) root);

  return result;
}

static VALUE Herb_extract_ruby(int argc, VALUE* argv, VALUE self) {
  VALUE source, options;
  rb_scan_args(argc, argv, "1:", &source, &options);

  char* string = (char*) check_string(source);
  hb_buffer_T output;

  if (!hb_buffer_init(&output, strlen(string))) { return Qnil; }

  herb_extract_ruby_options_T extract_options = HERB_EXTRACT_RUBY_DEFAULT_OPTIONS;

  if (!NIL_P(options)) {
    VALUE semicolons_value = rb_hash_lookup(options, rb_utf8_str_new_cstr("semicolons"));
    if (NIL_P(semicolons_value)) { semicolons_value = rb_hash_lookup(options, ID2SYM(rb_intern("semicolons"))); }
    if (!NIL_P(semicolons_value)) { extract_options.semicolons = RTEST(semicolons_value); }

    VALUE comments_value = rb_hash_lookup(options, rb_utf8_str_new_cstr("comments"));
    if (NIL_P(comments_value)) { comments_value = rb_hash_lookup(options, ID2SYM(rb_intern("comments"))); }
    if (!NIL_P(comments_value)) { extract_options.comments = RTEST(comments_value); }

    VALUE preserve_positions_value = rb_hash_lookup(options, rb_utf8_str_new_cstr("preserve_positions"));
    if (NIL_P(preserve_positions_value)) {
      preserve_positions_value = rb_hash_lookup(options, ID2SYM(rb_intern("preserve_positions")));
    }
    if (!NIL_P(preserve_positions_value)) { extract_options.preserve_positions = RTEST(preserve_positions_value); }
  }

  herb_extract_ruby_to_buffer_with_options(string, &output, &extract_options);

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

__attribute__((__visibility__("default"))) void Init_herb(void) {
  mHerb = rb_define_module("Herb");
  cPosition = rb_define_class_under(mHerb, "Position", rb_cObject);
  cLocation = rb_define_class_under(mHerb, "Location", rb_cObject);
  cRange = rb_define_class_under(mHerb, "Range", rb_cObject);
  cToken = rb_define_class_under(mHerb, "Token", rb_cObject);
  cResult = rb_define_class_under(mHerb, "Result", rb_cObject);
  cLexResult = rb_define_class_under(mHerb, "LexResult", cResult);
  cParseResult = rb_define_class_under(mHerb, "ParseResult", cResult);

  Init_herb_arena(mHerb);

  rb_define_singleton_method(mHerb, "parse", Herb_parse, -1);
  rb_define_singleton_method(mHerb, "lex", Herb_lex, -1);
  rb_define_singleton_method(mHerb, "parse_file", Herb_parse_file, -1);
  rb_define_singleton_method(mHerb, "lex_file", Herb_lex_file, -1);
  rb_define_singleton_method(mHerb, "extract_ruby", Herb_extract_ruby, -1);
  rb_define_singleton_method(mHerb, "extract_html", Herb_extract_html, 1);
  rb_define_singleton_method(mHerb, "version", Herb_version, 0);
}
