#include <ruby.h>

#include "../../src/include/util/hb_allocator.h"
#include "../../src/include/util/hb_arena_debug.h"

#include "error_helpers.h"
#include "extension.h"
#include "extension_helpers.h"
#include "nodes.h"

VALUE mHerb;
VALUE cPosition;
VALUE cLocation;
VALUE cRange;
VALUE cToken;
VALUE cResult;
VALUE cLexResult;
VALUE cParseResult;
VALUE cParserOptions;

typedef struct {
  AST_DOCUMENT_NODE_T* root;
  VALUE source;
  const parser_options_T* parser_options;
  hb_allocator_T allocator;
} parse_args_T;

typedef struct {
  hb_array_T* tokens;
  VALUE source;
  hb_allocator_T allocator;
} lex_args_T;

typedef struct {
  char* buffer_value;
} buffer_args_T;

static VALUE parse_convert_body(VALUE arg) {
  parse_args_T* args = (parse_args_T*) arg;

  return create_parse_result(args->root, args->source, args->parser_options);
}

static VALUE parse_cleanup(VALUE arg) {
  parse_args_T* args = (parse_args_T*) arg;

  if (args->root != NULL) { ast_node_free((AST_NODE_T*) args->root, &args->allocator); }

  hb_allocator_destroy(&args->allocator);

  return Qnil;
}

static VALUE lex_convert_body(VALUE arg) {
  lex_args_T* args = (lex_args_T*) arg;

  return create_lex_result(args->tokens, args->source);
}

static VALUE lex_cleanup(VALUE arg) {
  lex_args_T* args = (lex_args_T*) arg;

  if (args->tokens != NULL) { herb_free_tokens(&args->tokens, &args->allocator); }

  hb_allocator_destroy(&args->allocator);

  return Qnil;
}

static VALUE buffer_to_string_body(VALUE arg) {
  buffer_args_T* args = (buffer_args_T*) arg;

  return rb_utf8_str_new_cstr(args->buffer_value);
}

static VALUE buffer_cleanup(VALUE arg) {
  buffer_args_T* args = (buffer_args_T*) arg;

  if (args->buffer_value != NULL) { free(args->buffer_value); }

  return Qnil;
}

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

  lex_args_T args = { 0 };
  args.source = source;

  if (!hb_allocator_init(&args.allocator, HB_ALLOCATOR_ARENA)) { return Qnil; }

  args.tokens = herb_lex(string, &args.allocator);

  if (print_arena_stats) { hb_arena_print_stats((hb_arena_T*) args.allocator.context); }

  return rb_ensure(lex_convert_body, (VALUE) &args, lex_cleanup, (VALUE) &args);
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

  lex_args_T args = { 0 };
  args.source = read_file_to_ruby_string(file_path);

  if (!hb_allocator_init(&args.allocator, HB_ALLOCATOR_ARENA)) { return Qnil; }

  args.tokens = herb_lex_file(file_path, &args.allocator);

  if (print_arena_stats) { hb_arena_print_stats((hb_arena_T*) args.allocator.context); }

  return rb_ensure(lex_convert_body, (VALUE) &args, lex_cleanup, (VALUE) &args);
}

static VALUE Herb_parse(int argc, VALUE* argv, VALUE self) {
  VALUE source, options;
  rb_scan_args(argc, argv, "1:", &source, &options);

  char* string = (char*) check_string(source);
  bool print_arena_stats = false;

  parser_options_T parser_options = HERB_DEFAULT_PARSER_OPTIONS;

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

  parse_args_T args = { 0 };
  args.source = source;
  args.parser_options = &parser_options;

  if (!hb_allocator_init(&args.allocator, HB_ALLOCATOR_ARENA)) { return Qnil; }

  args.root = herb_parse(string, &parser_options, &args.allocator);

  if (print_arena_stats) { hb_arena_print_stats((hb_arena_T*) args.allocator.context); }

  return rb_ensure(parse_convert_body, (VALUE) &args, parse_cleanup, (VALUE) &args);
}

static VALUE Herb_parse_file(int argc, VALUE* argv, VALUE self) {
  VALUE path, options;
  rb_scan_args(argc, argv, "1:", &path, &options);

  char* file_path = (char*) check_string(path);
  bool print_arena_stats = false;

  VALUE source_value = read_file_to_ruby_string(file_path);
  char* string = (char*) check_string(source_value);

  parser_options_T parser_options = HERB_DEFAULT_PARSER_OPTIONS;

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

  parse_args_T args = { 0 };
  args.source = source_value;
  args.parser_options = &parser_options;

  if (!hb_allocator_init(&args.allocator, HB_ALLOCATOR_ARENA)) { return Qnil; }

  args.root = herb_parse(string, &parser_options, &args.allocator);

  if (print_arena_stats) { hb_arena_print_stats((hb_arena_T*) args.allocator.context); }

  return rb_ensure(parse_convert_body, (VALUE) &args, parse_cleanup, (VALUE) &args);
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

  hb_allocator_T allocator;
  if (!hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA)) { return Qnil; }

  herb_extract_ruby_to_buffer_with_options(string, &output, &extract_options, &allocator);

  hb_allocator_destroy(&allocator);

  buffer_args_T args = { .buffer_value = output.value };

  return rb_ensure(buffer_to_string_body, (VALUE) &args, buffer_cleanup, (VALUE) &args);
}

static VALUE Herb_extract_html(VALUE self, VALUE source) {
  char* string = (char*) check_string(source);
  hb_buffer_T output;

  if (!hb_buffer_init(&output, strlen(string))) { return Qnil; }

  hb_allocator_T allocator;
  if (!hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA)) { return Qnil; }

  herb_extract_html_to_buffer(string, &output, &allocator);

  hb_allocator_destroy(&allocator);

  buffer_args_T args = { .buffer_value = output.value };

  return rb_ensure(buffer_to_string_body, (VALUE) &args, buffer_cleanup, (VALUE) &args);
}

static VALUE Herb_arena_stats(int argc, VALUE* argv, VALUE self) {
  VALUE source, options;
  rb_scan_args(argc, argv, "1:", &source, &options);

  char* string = (char*) check_string(source);

  parser_options_T parser_options = HERB_DEFAULT_PARSER_OPTIONS;

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
  }

  hb_allocator_T allocator;
  if (!hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA)) { return Qnil; }

  AST_DOCUMENT_NODE_T* root = herb_parse(string, &parser_options, &allocator);

  hb_arena_stats_T stats = hb_arena_get_stats((hb_arena_T*) allocator.context);

  if (root != NULL) { ast_node_free((AST_NODE_T*) root, &allocator); }
  hb_allocator_destroy(&allocator);

  VALUE hash = rb_hash_new();
  rb_hash_aset(hash, ID2SYM(rb_intern("pages")), SIZET2NUM(stats.pages));
  rb_hash_aset(hash, ID2SYM(rb_intern("total_capacity")), SIZET2NUM(stats.total_capacity));
  rb_hash_aset(hash, ID2SYM(rb_intern("total_used")), SIZET2NUM(stats.total_used));
  rb_hash_aset(hash, ID2SYM(rb_intern("total_available")), SIZET2NUM(stats.total_available));
  rb_hash_aset(hash, ID2SYM(rb_intern("allocations")), SIZET2NUM(stats.allocations));
  rb_hash_aset(hash, ID2SYM(rb_intern("fragmentation")), SIZET2NUM(stats.fragmentation));
  rb_hash_aset(hash, ID2SYM(rb_intern("default_page_size")), SIZET2NUM(stats.default_page_size));

  return hash;
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
  cParserOptions = rb_define_class_under(mHerb, "ParserOptions", rb_cObject);

  rb_init_node_classes();
  rb_init_error_classes();

  rb_define_singleton_method(mHerb, "parse", Herb_parse, -1);
  rb_define_singleton_method(mHerb, "lex", Herb_lex, -1);
  rb_define_singleton_method(mHerb, "parse_file", Herb_parse_file, -1);
  rb_define_singleton_method(mHerb, "lex_file", Herb_lex_file, -1);
  rb_define_singleton_method(mHerb, "extract_ruby", Herb_extract_ruby, -1);
  rb_define_singleton_method(mHerb, "extract_html", Herb_extract_html, 1);
  rb_define_singleton_method(mHerb, "arena_stats", Herb_arena_stats, -1);
  rb_define_singleton_method(mHerb, "version", Herb_version, 0);
}
